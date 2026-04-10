import axios, { AxiosError, AxiosInstance } from 'axios';
import chalk from 'chalk';
import { HttpsCookieAgent } from 'http-cookie-agent/http';
import { CookieJar } from 'tough-cookie';
import { logger } from '../../config/logger/index.js';
import {
  ugNavigationHeaders,
  ugXhrHeaders,
} from '../../constants/headers.js';
import {
  loadUgCookieJarFromFile,
  schedulePersistUgCookieJar,
} from './ugAutocompleteCookieFile.js';

const UG_BASE = 'https://ugautopart.ru';
const UG_TIPS_PATH = '/ajax/modules2/search.tips/get';

/** Пересоздаём сессию с главной не реже раза в 4 ч — имитация «вернулся на вкладку». */
const HOMEPAGE_TTL_MS = 4 * 60 * 60 * 1000;

/**
 * Cooldown после ошибки (капча/403/5xx): не бьём внешний сайт, пока не истечёт пауза.
 * Значение растёт при последовательных ошибках (простой экспоненциальный backoff).
 */
const BACKOFF_BASE_MS = 30_000;
const BACKOFF_MAX_MS = 10 * 60 * 1000;

const CAPTCHA_MARKERS = /smartcaptcha|captcha|__js_photorep__|Что-то пошло не так/i;

// ─── Состояние модуля ───────────────────────────────────────────────
let clientBundlePromise: Promise<{ client: AxiosInstance; jar: CookieJar }> | null = null;
let initHomepagePromise: Promise<void> | null = null;
let initHomepageAt = 0;

let consecutiveErrors = 0;
let cooldownUntil = 0;

// ─── Bootstrap ──────────────────────────────────────────────────────

const getClientBundle = (): Promise<{ client: AxiosInstance; jar: CookieJar }> => {
  if (!clientBundlePromise) {
    clientBundlePromise = (async () => {
      const jar = await loadUgCookieJarFromFile();

      const httpsAgent = new HttpsCookieAgent({
        cookies: { jar },
        keepAlive: true,
        keepAliveMsecs: 1000,
        maxSockets: 6,
      });

      const client = axios.create({ httpsAgent, withCredentials: true });
      return { client, jar };
    })();
  }
  return clientBundlePromise;
};

/**
 * Singleton: заход на главную для получения сессионных кук.
 * Сбрасывается по TTL или принудительно при ошибке.
 */
const initializeCookies = async (): Promise<void> => {
  const { client, jar } = await getClientBundle();

  const expired = Date.now() - initHomepageAt > HOMEPAGE_TTL_MS;
  if (initHomepagePromise && !expired) {
    return initHomepagePromise;
  }

  initHomepagePromise = client
    .get(`${UG_BASE}/`, { headers: ugNavigationHeaders })
    .then(() => {
      initHomepageAt = Date.now();
      logger.info(chalk.green('Куки автокомплита UG успешно инициализированы'));
      schedulePersistUgCookieJar(jar);
    })
    .catch((error) => {
      initHomepagePromise = null;
      logger.error('Ошибка при инициализации куки автокомплита UG', { error });
      throw error;
    });

  return initHomepagePromise;
};

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * Проверяет ответ: если сервер вернул HTML с маркерами капчи/блока вместо JSON — throw.
 */
const assertNotBlocked = (data: unknown): void => {
  if (typeof data === 'string' && CAPTCHA_MARKERS.test(data)) {
    throw new UgBlockedError('Ответ содержит капчу/страницу блокировки');
  }
};

class UgBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UgBlockedError';
  }
}

const registerSuccess = (): void => {
  consecutiveErrors = 0;
};

const registerFailureAndThrow = (error: unknown): never => {
  consecutiveErrors += 1;
  const delay = Math.min(BACKOFF_BASE_MS * 2 ** (consecutiveErrors - 1), BACKOFF_MAX_MS);
  cooldownUntil = Date.now() + delay;
  logger.warn(
    `UG автокомплит: cooldown ${Math.round(delay / 1000)}с после ${consecutiveErrors} ошибок подряд`,
  );
  throw error;
};

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Автокомплит UG: общий CookieJar (с персистом на диск), инициализация главной, затем ajax tips.
 * Backoff при последовательных ошибках. Ошибка 400/403 — сброс init и повтор.
 */
export const getAutocomplete = async (term: string): Promise<unknown> => {
  if (Date.now() < cooldownUntil) {
    const remainSec = Math.ceil((cooldownUntil - Date.now()) / 1000);
    throw new Error(`UG автокомплит в cooldown (ещё ${remainSec}с)`);
  }

  const { client, jar } = await getClientBundle();
  await initializeCookies();

  try {
    const response = await client.get(`${UG_BASE}${UG_TIPS_PATH}`, {
      params: { term, locale: 'ru_RU' },
      headers: ugXhrHeaders,
    });

    assertNotBlocked(response.data);
    schedulePersistUgCookieJar(jar);
    registerSuccess();
    return response.data;
  } catch (error) {
    if (error instanceof UgBlockedError) {
      initHomepagePromise = null;
      registerFailureAndThrow(error);
    }

    if (axios.isAxiosError(error)) {
      const status = (error as AxiosError).response?.status;

      if (status === 400 || status === 403) {
        logger.warn(`Автокомплит UG: HTTP ${status}, сброс сессии и повтор`);

        initHomepagePromise = null;
        await initializeCookies();

        try {
          const retryResponse = await client.get(`${UG_BASE}${UG_TIPS_PATH}`, {
            params: { term, locale: 'ru_RU' },
            headers: ugXhrHeaders,
          });

          assertNotBlocked(retryResponse.data);
          schedulePersistUgCookieJar(jar);
          registerSuccess();
          return retryResponse.data;
        } catch (retryError) {
          registerFailureAndThrow(retryError);
        }
      }

      registerFailureAndThrow(error);
    }

    registerFailureAndThrow(error);
  }
};

import axios, { AxiosInstance } from 'axios';
import chalk from 'chalk';
import * as cheerio from 'cheerio';
import { HttpsCookieAgent } from 'http-cookie-agent/http';
import { DateTime } from 'luxon';
import { CookieJar } from 'tough-cookie';
import { Logger } from 'winston';
import { ProfitGetOrdersResponse } from '../profit.types.js';

// --- Configuration & Constants ---
const CONFIG = {
  baseUrl: 'https://api.pr-lg.ru',
  siteUrl: 'https://pr-lg.ru',
  delayBetweenRequests: 2000,
  delayBetweenPages: 1000,
  contextSwitchDelay: 2000,
  contextVerifyRetries: 3,
  contextVerifyBackoff: 2000,
  timeout: 60_000,
  maxRetries: 3,
} as const;

/**
 * Полный набор заголовков десктопного Chrome.
 * Сайт отдаёт разную разметку для мобильных/десктопных UA —
 * без этих заголовков элементы навигации профиля (.media-heading, .copy-n)
 * могут отсутствовать в ответе.
 */
const DESKTOP_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'Sec-CH-UA':
    '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
  'Sec-CH-UA-Mobile': '?0',
  'Sec-CH-UA-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
  Connection: 'keep-alive',
} as const;

const ORGANIZATIONS = [
  { name: 'IP_Kizim_Cash', switchId: '495435', profileId: '000009687' },
  { name: 'IP_Kizim_Bank', switchId: '14869822', profileId: '000047092' },
] as const;

// --- Types ---
type ProfitClient = AxiosInstance;
type Organization = (typeof ORGANIZATIONS)[number];

interface ActiveProfile {
  profileName: string;
  profileId: string;
  clientType: string;
}

// --- Helpers ---
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Создает настроенный экземпляр Axios с поддержкой CookieJar и Connection Pooling.
 * Все запросы идут с полным набором десктопных заголовков.
 */
const createClient = (): ProfitClient => {
  const jar = new CookieJar();

  const httpsAgent = new HttpsCookieAgent({
    cookies: { jar },
    keepAlive: true,
    keepAliveMsecs: 1000,
    maxSockets: 5,
    timeout: CONFIG.timeout,
  });

  return axios.create({
    httpsAgent,
    withCredentials: true,
    headers: { ...DESKTOP_HEADERS },
    timeout: CONFIG.timeout,
  });
};

/**
 * Обертка для повторного выполнения промисов (Retry Pattern)
 */
const withRetry = async <T>(
  fn: () => Promise<T>,
  retries: number = CONFIG.maxRetries,
  delayMs: number = 2000,
  logger?: Logger
): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;

    // Проверяем статус 429 или сетевые ошибки
    const isRateLimit =
      axios.isAxiosError(error) && error.response?.status === 429;
    const isNetworkError =
      axios.isAxiosError(error) &&
      ['ECONNRESET', 'ETIMEDOUT'].includes(error.code || '');

    if (isRateLimit || isNetworkError || retries > 0) {
      const waitTime = delayMs * (CONFIG.maxRetries - retries + 1); // Exponential-ish backoff

      if (logger) {
        logger.warn(
          chalk.yellow(
            `[profit] Retry needed. Attempts left: ${chalk.bold(retries)}. Waiting ${waitTime}ms...`
          )
        );
      }

      await delay(waitTime);
      return withRetry(fn, retries - 1, delayMs * 2, logger);
    }
    throw error;
  }
};

// --- Profile Verification ---

/**
 * Парсит HTML и извлекает данные активного профиля из боковой панели.
 * Селекторы: .media-heading > a (имя), .copy-n[data-id] (ID), .media-text (тип).
 */
const parseActiveProfile = (html: string): ActiveProfile | null => {
  const $ = cheerio.load(html);

  const profileName = $('.media-heading > a').first().text().trim();
  const profileId = $('.copy-n').first().attr('data-id')?.trim() ?? '';
  const clientType = $('.media-text').first().text().trim();

  if (!profileId) return null;

  return { profileName, profileId, clientType };
};

/**
 * Загружает страницу профиля и определяет, какой клиент сейчас активен.
 * Используется как fallback, если parseActiveProfile не находит данных
 * в ответе на переключение контекста.
 */
const getActiveProfile = async (
  client: ProfitClient,
  logger: Logger,
  signal?: AbortSignal
): Promise<ActiveProfile | null> => {
  const { data: html } = await client.get(`${CONFIG.siteUrl}/account/profile`, {
    headers: { Referer: CONFIG.siteUrl },
    maxRedirects: 5,
    signal,
  });

  return parseActiveProfile(html);
};

// --- Core Business Logic ---

/**
 * Выполняет вход в систему
 */
const performLogin = async (
  client: ProfitClient,
  logger: Logger,
  signal?: AbortSignal
): Promise<void> => {
  const { PROFIT_LOGIN: email, PROFIT_PASSWORD: password } = process.env;

  if (!email || !password) {
    throw new Error('PROFIT_LOGIN or PROFIT_PASSWORD is missing in env');
  }

  logger.debug(chalk.blue('[profit] Starting login sequence...'));

  try {
    const { data: html } = await client.get(`${CONFIG.siteUrl}/login`, {
      headers: { Referer: CONFIG.siteUrl },
      signal,
    });
    const $ = cheerio.load(html);
    const csrfToken = $('meta[name="csrf-token"]').attr('content') || '';

    const params = new URLSearchParams();
    params.append('_csrf', csrfToken);
    params.append('UserForm[email]', email);
    params.append('UserForm[password]', password);
    params.append('UserForm[rememberMe]', '1');

    const { data: loginHtml } = await client.post(
      `${CONFIG.siteUrl}/login`,
      params,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Referer: `${CONFIG.siteUrl}/login`,
          Origin: CONFIG.siteUrl,
        },
        maxRedirects: 5,
        signal,
      }
    );

    if (!loginHtml.includes('Оптовый клиент')) {
      throw new Error('Marker "Оптовый клиент" not found in response');
    }

    const profile = parseActiveProfile(loginHtml);
    if (profile) {
      logger.info(
        chalk.green('✔ [profit] Login successful') +
          ` — active profile: ${chalk.cyan(profile.profileName)} (${profile.profileId})`
      );
    } else {
      logger.info(chalk.green('✔ [profit] Login successful'));
    }
  } catch (error) {
    logger.error(chalk.red('[profit] Login failed'));
    throw error;
  }
};

/**
 * Переключает контекст организации и верифицирует результат.
 *
 * HTML ответа на /account/legals/select/id/{id} содержит данные
 * ПРЕДЫДУЩЕГО профиля (сервер рендерит страницу до применения switch).
 * Поэтому верификация всегда выполняется отдельным запросом
 * к /account/profile после задержки.
 */
const switchContext = async (
  client: ProfitClient,
  org: Organization,
  logger: Logger,
  signal?: AbortSignal
): Promise<void> => {
  try {
    await client.get(
      `${CONFIG.siteUrl}/account/legals/select/id/${org.switchId}`,
      {
        headers: { Referer: `${CONFIG.siteUrl}/account/legals` },
        maxRedirects: 5,
        signal,
      }
    );

    await delay(CONFIG.contextSwitchDelay);

    // Повторная верификация с backoff: сервер может применить switch
    // с задержкой, поэтому делаем несколько попыток
    let profile: ActiveProfile | null = null;

    for (let attempt = 0; attempt <= CONFIG.contextVerifyRetries; attempt++) {
      profile = await getActiveProfile(client, logger, signal);

      if (profile?.profileId === org.profileId) break;

      if (attempt < CONFIG.contextVerifyRetries) {
        const backoff = CONFIG.contextVerifyBackoff * (attempt + 1);
        logger.debug(
          `[profit] Profile mismatch on verify attempt ${attempt + 1}, ` +
            `retrying in ${backoff}ms...`
        );
        await delay(backoff);
      }
    }

    if (!profile) {
      throw new Error(
        `Не удалось определить активный профиль после переключения на ${org.name}`
      );
    }

    if (profile.profileId !== org.profileId) {
      throw new Error(
        `Верификация контекста не пройдена: ожидался profileId=${org.profileId} (${org.name}), ` +
          `получен profileId=${profile.profileId} (${profile.profileName})`
      );
    }

    logger.debug(
      `[profit] Switched & verified: ${chalk.cyan(org.name)} — ` +
        `profile: ${profile.profileName}, id: ${profile.profileId}`
    );
  } catch (error) {
    throw new Error(
      `Failed to switch to ${org.name}: ${error instanceof Error ? error.message : 'Unknown'}`
    );
  }
};

/**
 * Проверяет, что ВСЕ заказы на странице старше cutoff.
 * API отдаёт заказы от новых к старым — если целая страница старше порога,
 * все последующие страницы тоже будут старше.
 */
const isPageBeyondCutoff = (
  orders: ProfitGetOrdersResponse['data'],
  cutoffMs: number
): boolean => {
  if (orders.length === 0) return true;
  return orders.every((o) => {
    const dt = DateTime.fromISO(o.datetime);
    return dt.isValid && dt.toMillis() < cutoffMs;
  });
};

/**
 * Получает заказы для текущего контекста с ранним прекращением пагинации.
 * API не поддерживает серверную фильтрацию по дате (date_start/date_end disabled),
 * но заказы отсортированы от новых к старым — как только целая страница
 * оказывается старше cutoffDate, дальнейшие страницы не запрашиваются.
 */
const fetchAllOrders = async (
  client: ProfitClient,
  secret: string,
  cutoffDate: Date,
  logger: Logger,
  signal?: AbortSignal
): Promise<ProfitGetOrdersResponse> => {
  const cutoffMs = cutoffDate.getTime();

  const { data: firstPage } = await client.get<ProfitGetOrdersResponse>(
    `${CONFIG.baseUrl}/orders/list`,
    { params: { secret, action: 'list', page: 1 }, signal }
  );

  const result: ProfitGetOrdersResponse = {
    pages: firstPage.pages,
    currentPage: 1,
    pageSize: firstPage.pageSize,
    data: [...(firstPage.data ?? [])],
  };

  if (firstPage.pages > 1 && !isPageBeyondCutoff(firstPage.data ?? [], cutoffMs)) {
    logger.debug(
      `[profit] Found ${chalk.yellow(firstPage.pages)} total pages, paginating until cutoff ${cutoffDate.toISOString()}...`
    );

    for (let page = 2; page <= firstPage.pages; page++) {
      await delay(CONFIG.delayBetweenPages);
      const { data } = await client.get<ProfitGetOrdersResponse>(
        `${CONFIG.baseUrl}/orders/list`,
        { params: { secret, action: 'list', page }, signal }
      );

      if (!data?.data || !Array.isArray(data.data)) break;

      result.data.push(...data.data);

      if (isPageBeyondCutoff(data.data, cutoffMs)) {
        logger.debug(
          `[profit] Page ${page} fully beyond cutoff, stopping pagination`
        );
        break;
      }
    }
  }

  return result;
};

// --- Main Workflow ---

export const fetchProfitOrders = async (
  logger: Logger,
  targetSyncDate: Date,
  signal?: AbortSignal
): Promise<ProfitGetOrdersResponse> => {
  const secret = process.env.PROFIT_API_KEY;
  if (!secret) throw new Error('PROFIT_API_KEY is missing');

  const client = createClient();

  // Инициализация сессии
  await performLogin(client, logger, signal);

  // Аккумулятор результатов
  const result: ProfitGetOrdersResponse = {
    pages: 0,
    currentPage: 1,
    pageSize: 0,
    data: [],
  };

  let successCount = 0;
  const errors: string[] = [];

  // Последовательная обработка организаций
  for (const [index, org] of ORGANIZATIONS.entries()) {
    logger.info(
      `[profit] Processing: ${chalk.magenta(org.name)} ${chalk.gray(`(${index + 1}/${ORGANIZATIONS.length})`)}`
    );

    try {
      await withRetry(
        () => switchContext(client, org, logger, signal),
        2,
        1000,
        logger
      );

      const response = await withRetry(
        () => fetchAllOrders(client, secret, targetSyncDate, logger, signal),
        CONFIG.maxRetries,
        2000,
        logger
      );

      if (response?.data && Array.isArray(response.data)) {
        result.data.push(...response.data);
        result.pages = Math.max(result.pages, response.pages);
        successCount++;

        logger.info(
          `[profit] ${chalk.green('Success')} for ${org.name}: found ${chalk.yellow(response.data.length)} orders`
        );
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`${org.name}: ${msg}`);
      logger.error(chalk.red(`[profit] Failed processing ${org.name}: ${msg}`));
    }

    // Задержка перед следующей итерацией, если она не последняя
    if (index < ORGANIZATIONS.length - 1) {
      await delay(CONFIG.delayBetweenRequests);
    }
  }

  if (successCount === 0) {
    throw new Error(`All Profit orgs failed. Errors: ${errors.join('; ')}`);
  }

  // Дедупликация
  const uniqueOrders = Array.from(
    new Map(result.data.map((order) => [order.order_id, order])).values()
  );

  // High-Water Mark: отсекаем заказы старше targetSyncDate
  const targetMs = targetSyncDate.getTime();
  const filteredOrders = uniqueOrders.filter((order) => {
    const parsed = DateTime.fromISO(order.datetime);
    return parsed.isValid && parsed.toMillis() >= targetMs;
  });

  result.data = filteredOrders;

  logger.info(chalk.bold.green('[profit] Fetch cycle completed'), {
    totalOrders: uniqueOrders.length,
    afterHighWaterMark: filteredOrders.length,
    cutoff: targetSyncDate.toISOString(),
    successfulSources: successCount,
  });

  return result;
};

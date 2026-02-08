import axios, { AxiosInstance } from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import chalk from 'chalk';
import * as cheerio from 'cheerio';
import { CookieJar } from 'tough-cookie';
import { Logger } from 'winston';
import { ProfitGetOrdersResponse } from '../profit.types.js'; // Убедись, что путь верен

// --- Configuration & Constants ---
const CONFIG = {
  baseUrl: 'https://api.pr-lg.ru',
  siteUrl: 'https://pr-lg.ru',
  delayBetweenRequests: 2000,
  contextSwitchDelay: 1000,
  timeout: 15000,
  maxRetries: 3,
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
} as const;

const ORGANIZATIONS = [
  { name: 'IP_Kizim_Cash', switchId: '14869822' },
  { name: 'IP_Kizim_Bank', switchId: '495435' },
] as const;

// --- Types ---
type ProfitClient = AxiosInstance;
type Organization = (typeof ORGANIZATIONS)[number];

// --- Helpers ---
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Создает настроенный экземпляр Axios с поддержкой CookieJar
 */
const createClient = (): ProfitClient => {
  const jar = new CookieJar();
  return wrapper(
    axios.create({
      jar,
      withCredentials: true,
      headers: { 'User-Agent': CONFIG.userAgent },
      timeout: CONFIG.timeout,
    })
  );
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

    if (isRateLimit || retries > 0) {
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

// --- Core Business Logic ---

/**
 * Выполняет вход в систему
 */
const performLogin = async (
  client: ProfitClient,
  logger: Logger
): Promise<void> => {
  const { PROFIT_LOGIN: email, PROFIT_PASSWORD: password } = process.env;

  if (!email || !password) {
    throw new Error('PROFIT_LOGIN or PROFIT_PASSWORD is missing in env');
  }

  logger.debug(chalk.blue('[profit] Starting login sequence...'));

  try {
    // 1. Получаем CSRF токен
    const { data: html } = await client.get(`${CONFIG.siteUrl}/login`);
    const $ = cheerio.load(html);
    const csrfToken = $('meta[name="csrf-token"]').attr('content') || '';

    // 2. Подготавливаем данные (используем URLSearchParams вместо querystring)
    const params = new URLSearchParams();
    params.append('_csrf', csrfToken);
    params.append('UserForm[email]', email);
    params.append('UserForm[password]', password);
    params.append('UserForm[rememberMe]', '1');

    // 3. Отправляем форму
    const { data } = await client.post(`${CONFIG.siteUrl}/login`, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: `${CONFIG.siteUrl}/login`,
      },
      maxRedirects: 5,
    });

    if (!data.includes('Оптовый клиент')) {
      throw new Error('Marker "Оптовый клиент" not found in response');
    }

    logger.info(chalk.green('✔ [profit] Login successful'));
  } catch (error) {
    logger.error(chalk.red('[profit] Login failed'));
    throw error;
  }
};

/**
 * Переключает контекст организации
 */
const switchContext = async (
  client: ProfitClient,
  org: Organization,
  logger: Logger
): Promise<void> => {
  try {
    await client.get(
      `${CONFIG.siteUrl}/account/legals/select/id/${org.switchId}`,
      {
        maxRedirects: 5,
      }
    );
    logger.debug(`[profit] Switched context to ${chalk.cyan(org.name)}`);
  } catch (error) {
    throw new Error(
      `Failed to switch to ${org.name}: ${error instanceof Error ? error.message : 'Unknown'}`
    );
  }
};

/**
 * Получает список заказов
 */
const fetchOrders = async (
  client: ProfitClient,
  secret: string
): Promise<ProfitGetOrdersResponse> => {
  const params = { secret, action: 'list', page: 1 };
  const { data } = await client.get<ProfitGetOrdersResponse>(
    `${CONFIG.baseUrl}/orders/list`,
    { params }
  );
  return data;
};

// --- Main Workflow ---

export const fetchProfitOrders = async (
  logger: Logger
): Promise<ProfitGetOrdersResponse> => {
  const secret = process.env.PROFIT_API_KEY;
  if (!secret) throw new Error('PROFIT_API_KEY is missing');

  const client = createClient();

  // Инициализация сессии
  await performLogin(client, logger);

  // Аккумулятор результатов
  const result: ProfitGetOrdersResponse = {
    pages: 0,
    currentPage: 1,
    pageSize: 0,
    data: [],
  };

  let successCount = 0;
  const errors: string[] = [];

  // Последовательная обработка организаций (reduce для последовательности промисов был бы сложнее для чтения здесь,
  // for..of с await - идиоматичный способ для последовательных асинхронных операций в JS)
  for (const [index, org] of ORGANIZATIONS.entries()) {
    logger.info(
      `[profit] Processing: ${chalk.magenta(org.name)} ${chalk.gray(`(${index + 1}/${ORGANIZATIONS.length})`)}`
    );

    try {
      // 1. Переключаем
      await withRetry(
        () => switchContext(client, org, logger),
        2,
        1000,
        logger
      );

      // 2. Ждем применения кук на сервере
      await delay(CONFIG.contextSwitchDelay);

      // 3. Забираем данные с ретраями
      const response = await withRetry(
        () => fetchOrders(client, secret),
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

  // Дедупликация (Функциональный подход через Map)
  const uniqueOrders = Array.from(
    new Map(result.data.map((order) => [order.order_id, order])).values()
  );

  result.data = uniqueOrders;

  logger.info(chalk.bold.green('[profit] Fetch cycle completed'), {
    totalUniqueOrders: uniqueOrders.length,
    successfulSources: successCount,
  });

  return result;
};

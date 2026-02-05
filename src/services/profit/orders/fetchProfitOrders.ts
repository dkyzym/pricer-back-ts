import axios, { AxiosInstance } from 'axios';
import https from 'https';
import { Logger } from 'winston';
import { ProfitGetOrdersResponse, ProfitOrderRaw } from '../profit.types.js';

const BASE_URL = 'https://api.pr-lg.ru';

/**
 * КОНФИГУРАЦИЯ
 */
const CONFIG = {
  // Минимальная задержка (мс)
  DELAY_MIN: 2000,
  // Случайная добавка к задержке (мс)
  DELAY_JITTER: 500,
  // Таймаут одного запроса
  TIMEOUT: 30000,
  // Макс. попыток при ошибке
  MAX_RETRIES: 3,
  // СКОЛЬКО ПОСЛЕДНИХ СТРАНИЦ ГРУЗИТЬ
  // 2 страницы = 200 последних заказов. Этого обычно достаточно для синхронизации.
  // Если нужно выкачать всю историю за год, поставьте 100.
  FETCH_DEPTH_LIMIT: 1,
};

/**
 * Настройка HTTPS агента
 * keepAlive: true критически важен для серийных запросов
 */
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: true,
  maxSockets: 1,
});

/**
 * Создаем инстанс axios с предустановками
 */
const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: CONFIG.TIMEOUT,
  httpsAgent,
  headers: {
    'User-Agent': 'ProfitIntegration/1.0 (NodeJS)',
    Connection: 'keep-alive',
  },
});

interface RequestParams {
  secret: string;
  page: number;
  payment_id?: string;
}

const REQUEST_VARIANTS = [
  { payment_id: '1' }, // Наличные
  { payment_id: '2' }, // Безналичные
] as const;

/**
 * Умная задержка с рандомизацией (Jitter)
 */
const smartDelay = (ms: number) => {
  const jitter = Math.floor(Math.random() * CONFIG.DELAY_JITTER);
  const totalDelay = ms + jitter;
  return new Promise((resolve) => setTimeout(resolve, totalDelay));
};

/**
 * Выполнение одного запроса с ретраями
 */
const fetchPageWithRetry = async (
  params: RequestParams,
  logger: Logger,
  retryCount = 0
): Promise<ProfitGetOrdersResponse | null> => {
  try {
    const response = await apiClient.get<ProfitGetOrdersResponse>(
      '/orders/list',
      { params }
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const isRateLimit = error.response?.status === 429;
      const isServerError =
        error.response?.status && error.response.status >= 500;

      if ((isRateLimit || isServerError) && retryCount < CONFIG.MAX_RETRIES) {
        // При 429 увеличиваем паузу агрессивно
        const backoffBase = isRateLimit ? 2500 : 1000;
        const waitTime = Math.pow(2, retryCount) * backoffBase;

        logger.warn(
          `[profit] ${isRateLimit ? 'Rate limit hit' : 'Server error'}, retrying after ${waitTime}ms`,
          {
            attempt: retryCount + 1,
            status: error.response?.status,
            page: params.page,
          }
        );

        await smartDelay(waitTime);
        return fetchPageWithRetry(params, logger, retryCount + 1);
      }

      logger.error('[profit] Request failed', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        page: params.page,
        payment_id: params.payment_id,
      });
    }
    return null;
  }
};

/**
 * Сбор страниц (с ограничением глубины)
 */
const collectAllPages = async (
  variant: (typeof REQUEST_VARIANTS)[number],
  secret: string,
  logger: Logger
): Promise<ProfitOrderRaw[]> => {
  const orders: ProfitOrderRaw[] = [];
  let currentPage = 1;
  let totalPages = 1;

  logger.info(`[profit] Starting fetch for payment_id: ${variant.payment_id}`);

  do {
    const result = await fetchPageWithRetry(
      { secret, page: currentPage, payment_id: variant.payment_id },
      logger
    );

    if (!result || !result.data) {
      logger.warn(`[profit] Broken page ${currentPage}, skipping remainder.`);
      break;
    }

    orders.push(...result.data);

    if (currentPage === 1) {
      totalPages = result.pages || 1;
    }

    logger.debug(
      `[profit] Page ${currentPage}/${totalPages} ok. (+${result.data.length} orders)`
    );

    currentPage++;

    // Условие выхода:
    // 1. Кончились страницы в API
    // 2. ИЛИ мы достигли нашего лимита глубины (например, скачали 2 страницы)
    const limitReached = currentPage - 1 >= CONFIG.FETCH_DEPTH_LIMIT;
    if (limitReached && currentPage <= totalPages) {
      logger.info(
        `[profit] Depth limit reached (${CONFIG.FETCH_DEPTH_LIMIT} pages). Stopping fetch.`
      );
      break;
    }

    if (currentPage <= totalPages) {
      await smartDelay(CONFIG.DELAY_MIN);
    }
  } while (currentPage <= totalPages);

  return orders;
};

/**
 * ГЛАВНАЯ ФУНКЦИЯ
 */
export const fetchProfitOrders = async (
  logger: Logger
): Promise<ProfitGetOrdersResponse> => {
  const secret = process.env.PROFIT_API_KEY;
  if (!secret) throw new Error('PROFIT_API_KEY is missing');

  const allOrdersMap = new Map<string, ProfitOrderRaw>();
  let totalFetchedCount = 0;

  for (const variant of REQUEST_VARIANTS) {
    const variantOrders = await collectAllPages(variant, secret, logger);
    totalFetchedCount += variantOrders.length;

    for (const order of variantOrders) {
      allOrdersMap.set(order.order_id, order);
    }

    if (variant !== REQUEST_VARIANTS[REQUEST_VARIANTS.length - 1]) {
      await smartDelay(CONFIG.DELAY_MIN);
    }
  }

  const uniqueOrders = Array.from(allOrdersMap.values());

  logger.info('[profit] Sync complete', {
    totalFetched: totalFetchedCount,
    unique: uniqueOrders.length,
    depthLimit: CONFIG.FETCH_DEPTH_LIMIT,
  });

  return {
    pages: 1,
    currentPage: 1,
    pageSize: uniqueOrders.length,
    data: uniqueOrders,
  };
};

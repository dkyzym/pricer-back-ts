import axios from 'axios';
import https from 'https';
import { Logger } from 'winston';
import { ProfitGetOrdersResponse } from '../profit.types.js';

const BASE_URL = 'https://api.pr-lg.ru';

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

/**
 * КОНФИГУРАЦИЯ ЗАПРОСОВ
 * Варианты запросов для получения данных с разными фильтрами
 */
const REQUEST_VARIANTS = [
  {
    payment_id: '1', // Наличные / Банковской картой
  },
  {
    payment_id: '2', // Безналичные
  },
];

/**
 * Задержка между запросами (мс)
 */
const DELAY_BETWEEN_REQUESTS = 1000; // 1 секунда

/**
 * Максимальное количество повторных попыток при ошибке 429
 */
const MAX_RETRIES = 3;

/**
 * Вспомогательная функция для задержки
 */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Выполнение одного запроса с повторными попытками при rate limiting
 */
const fetchWithRetry = async (
  params: Record<string, any>,
  logger: Logger,
  retryCount = 0
): Promise<ProfitGetOrdersResponse | null> => {
  try {
    const response = await axios.get<ProfitGetOrdersResponse>(
      `${BASE_URL}/orders/list`,
      {
        params,
        httpsAgent,
        timeout: 15000,
      }
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      // Если получили 429 (Too Many Requests)
      if (error.response?.status === 429 && retryCount < MAX_RETRIES) {
        const waitTime = Math.pow(2, retryCount) * 2000; // Экспоненциальная задержка: 2s, 4s, 8s
        logger.warn(
          `[profit] Rate limit hit, retrying after ${waitTime}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`,
          {
            params,
          }
        );
        await delay(waitTime);
        return fetchWithRetry(params, logger, retryCount + 1);
      }

      // Логируем другие ошибки
      logger.error('[profit] Request failed', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        params,
      });
    }
    throw error;
  }
};

/**
 * ОСНОВНАЯ ФУНКЦИЯ
 * Получает заказы из Profit API с разными параметрами фильтрации
 */
export const fetchProfitOrders = async (
  logger: Logger
): Promise<ProfitGetOrdersResponse> => {
  const secret = process.env.PROFIT_API_KEY;

  if (!secret) {
    throw new Error('PROFIT_API_KEY is missing');
  }

  // Общие параметры для всех запросов
  const baseParams = {
    secret,
    page: 1,
  };

  const combinedData: ProfitGetOrdersResponse = {
    pages: 0,
    currentPage: 1,
    pageSize: 0,
    data: [],
  };

  let successCount = 0;
  let failedCount = 0;

  // ПОСЛЕДОВАТЕЛЬНОЕ выполнение запросов с задержками (НЕ параллельное)
  // Это помогает избежать rate limiting
  for (let i = 0; i < REQUEST_VARIANTS.length; i++) {
    const variant = REQUEST_VARIANTS[i];
    const params = { ...baseParams, ...variant };

    logger.info(
      `[profit] Fetching orders variant ${i + 1}/${REQUEST_VARIANTS.length}`,
      {
        payment_id: variant.payment_id,
      }
    );

    try {
      const result = await fetchWithRetry(params, logger);

      if (result && result.data && Array.isArray(result.data)) {
        combinedData.data.push(...result.data);
        successCount++;

        logger.info(
          `[profit] Variant ${i + 1} succeeded: ${result.data.length} orders`,
          {
            payment_id: variant.payment_id,
            totalPages: result.pages,
          }
        );

        // Берем макс. кол-во страниц из всех ответов
        if (result.pages > combinedData.pages) {
          combinedData.pages = result.pages;
        }
      }
    } catch (error) {
      failedCount++;
      logger.warn(`[profit] Variant ${i + 1} failed`, {
        payment_id: variant.payment_id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Задержка между запросами (кроме последнего)
    if (i < REQUEST_VARIANTS.length - 1) {
      logger.debug(
        `[profit] Waiting ${DELAY_BETWEEN_REQUESTS}ms before next request`
      );
      await delay(DELAY_BETWEEN_REQUESTS);
    }
  }

  // Если все запросы провалились
  if (successCount === 0) {
    throw new Error(
      `All Profit request variants failed (${failedCount}/${REQUEST_VARIANTS.length})`
    );
  }

  // Удаляем дубликаты заказов по order_id
  const uniqueOrders = new Map();
  for (const order of combinedData.data) {
    uniqueOrders.set(order.order_id, order);
  }
  combinedData.data = Array.from(uniqueOrders.values());

  logger.info('[profit] Orders fetched successfully', {
    totalOrders: combinedData.data.length,
    successfulRequests: successCount,
    failedRequests: failedCount,
    totalPages: combinedData.pages,
  });

  return combinedData;
};

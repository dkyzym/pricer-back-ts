import axios from 'axios';
import { DateTime } from 'luxon';
import { Logger } from 'winston';
import { AutosputnikGetOrdersResponse } from '../autosputnik.types.js';
import { BASE_URL, getToken, tokenCache } from '../autosputnikApi.js';

/**
 * Запрашивает заказы за последние 90 дней.
 * Использует внедренный logger для отслеживания хода выполнения.
 */

const ordersPeriod = 90;

export const fetchAutosputnikOrders = async (
  supplier: 'autosputnik' | 'autosputnik_bn',
  logger: Logger
): Promise<AutosputnikGetOrdersResponse> => {
  // 1. Получаем токен (кеш или новый запрос)
  let token: string;
  try {
    token = await getToken(supplier);
  } catch (e) {
    logger.error(`[${supplier}] Failed to get token initially`, { error: e });
    throw e;
  }

  // Настройка временного окна (бизнес-логика зашита здесь)
  const dateStart = DateTime.now()
    .minus({ days: ordersPeriod })
    .startOf('day')
    .toISO();
  const dateEnd = DateTime.now().endOf('day').toISO();

  const payload = {
    date_start: dateStart,
    date_end: dateEnd,
    orderid: 0,
    page: 1,
    pageSize: 500,
  };

  const makeRequest = async (authToken: string) => {
    return axios.post<AutosputnikGetOrdersResponse>(
      `${BASE_URL}/order/get`,
      payload,
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
  };

  try {
    const { data } = await makeRequest(token);
    return data;
  } catch (error) {
    // Обработка протухшего токена (401)
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      logger.warn(`[${supplier}] Token expired (401), refreshing...`);

      // Удаляем из кеша
      tokenCache.delete(supplier);

      try {
        // Пробуем получить новый токен и повторить запрос
        const newToken = await getToken(supplier);
        const { data } = await makeRequest(newToken);
        logger.info(`[${supplier}] Retry successful with new token`);
        return data;
      } catch (retryError) {
        logger.error(`[${supplier}] Retry failed after token refresh`, {
          error: retryError,
        });
        throw retryError;
      }
    }

    // Логируем прочие ошибки (сеть, 500 и т.д.)
    logger.error(`[${supplier}] API Request failed`, {
      status: axios.isAxiosError(error) ? error.response?.status : 'unknown',
      error: error,
    });
    throw error;
  }
};

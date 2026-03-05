import axios, { AxiosError } from 'axios';
import { DateTime } from 'luxon';
import { Logger } from 'winston';
import type { TurboCarsOrderRaw, TurboCarsOrdersResponse } from './turboCars.types.js';

const MAX_PAGES = 100;
const PER_PAGE = 100;
const ORDERS_ENDPOINT = '/orders:info';

const formatDateForTurboCars = (date: Date): string => {
  return DateTime.fromJSDate(date).toFormat('yyyy-MM-dd');
};

/**
 * Запрашивает заказы TurboCars за период от targetSyncDate до текущего дня.
 * Собирает все страницы с пагинацией, ограниченной MAX_PAGES.
 */
export const fetchTurboCarsOrders = async (
  logger: Logger,
  targetSyncDate: Date
): Promise<TurboCarsOrderRaw[]> => {
  const baseUrl = process.env.TURBOCARS_BASE_URL || 'https://turbo-cars.ru/api';
  const token = process.env.TURBOCARS_API_TOKEN;

  if (!token) {
    throw new Error(
      'TURBOCARS_API_TOKEN is not set. Configure it in .env to fetch TurboCars orders.'
    );
  }

  const periodStart = formatDateForTurboCars(targetSyncDate);
  const periodEnd = formatDateForTurboCars(new Date());

  const url = `${baseUrl.replace(/\/$/, '')}${ORDERS_ENDPOINT}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };

  const allOrders: TurboCarsOrderRaw[] = [];
  let page = 1;

  while (page <= MAX_PAGES) {
    const params: Record<string, string | number> = {
      period_start: periodStart,
      period_end: periodEnd,
      per_page: PER_PAGE,
      page,
    };

    try {
      const response = await axios.get<TurboCarsOrdersResponse>(url, {
        params,
        headers,
        timeout: 60_000,
      });

      const data = response.data;

      if (!data?.orders_data || !Array.isArray(data.orders_data)) {
        logger.warn('[turboCars] Unexpected response shape, no orders_data array', {
          page,
          keys: data ? Object.keys(data) : [],
        });
        break;
      }

      const orders = data.orders_data;
      allOrders.push(...orders);

      if (orders.length < PER_PAGE) {
        logger.debug('[turboCars] Last page reached', { page, received: orders.length });
        break;
      }

      page++;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axErr = error as AxiosError<{ error_code?: string; error_message?: string }>;
        const status = axErr.response?.status;
        const body = axErr.response?.data;

        if (status && (status < 200 || status >= 300)) {
          const msg =
            typeof body === 'object' && body
              ? body.error_message ?? JSON.stringify(body)
              : axErr.message;
          throw new Error(`TurboCars API error (${status}): ${msg}`);
        }
      }
      throw error;
    }
  }

  if (page > MAX_PAGES) {
    logger.warn('[turboCars] Pagination limit reached, stopping to prevent OOM', {
      maxPages: MAX_PAGES,
      collectedOrders: allOrders.length,
    });
  }

  return allOrders;
};

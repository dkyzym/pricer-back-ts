import axios, { AxiosError } from 'axios';
import { Logger } from 'winston';

import {
  TurboCarsBrandSearchResponse,
  TurboCarsBrandSearchSuccess,
  TurboCarsErrorResponse,
  TurboCarsOffersSearchResponse,
  TurboCarsOffersSearchSuccess,
} from './turboCars.types.js';

const MAX_TIMEOUT_MS = 60_000;

const createTurboCarsClientConfig = () => {
  const baseUrl = process.env.TURBOCARS_BASE_URL || 'https://turbo-cars.ru/api';
  const token = process.env.TURBOCARS_API_TOKEN;

  if (!token) {
    throw new Error(
      'TURBOCARS_API_TOKEN is not set. Configure it in .env for TurboCars API.'
    );
  }

  const urlBase = baseUrl.replace(/\/$/, '');
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };

  return { urlBase, headers };
};

const isErrorResponse = (data: unknown): data is TurboCarsErrorResponse => {
  if (!data || typeof data !== 'object') return false;
  return typeof (data as any).error_code === 'string';
};

export const getTurboCarsBrands = async (
  code: string,
  logger: Logger
): Promise<TurboCarsBrandSearchSuccess | null> => {
  const { urlBase, headers } = createTurboCarsClientConfig();
  const url = `${urlBase}/brands:search`;

  try {
    const response = await axios.get<TurboCarsBrandSearchResponse>(url, {
      params: { code },
      headers,
      timeout: MAX_TIMEOUT_MS,
    });

    const data = response.data;

    if (isErrorResponse(data)) {
      logger.warn('[turboCars] Бизнес-ошибка при запросе /brands:search', {
        error_code: (data as any).error_code,
        error_message: (data as any).error_message,
      });
      return null;
    }

    if (!data || !Array.isArray(data.brands)) {
      logger.warn('[turboCars] Некорректный ответ /brands:search', {
        keys: data ? Object.keys(data as any) : [],
      });
      return null;
    }

    return data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axErr = error as AxiosError<any>;
      const status = axErr.response?.status;
      const body = axErr.response?.data;

      if (status && status >= 400 && status < 500 && isErrorResponse(body)) {
        logger.warn('[turboCars] HTTP 4xx при запросе /brands:search', {
          status,
          error_code: body.error_code,
          error_message: body.error_message,
        });
        return null;
      }
    }

    logger.error('[turboCars] Ошибка сети при запросе /brands:search', error);
    throw error;
  }
};

interface GetTurboCarsOffersOptions {
  code: string;
  brand: string;
  withNonReturnable?: 0 | 1;
  withOffers?: 0 | 1;
}

export const getTurboCarsOffers = async (
  options: GetTurboCarsOffersOptions,
  logger: Logger
): Promise<TurboCarsOffersSearchSuccess | null> => {
  const { urlBase, headers } = createTurboCarsClientConfig();
  const url = `${urlBase}/offers:search`;

  const withNonReturnable = options.withNonReturnable ?? 0;
  const withOffers = options.withOffers ?? 1;

  try {
    const response = await axios.get<TurboCarsOffersSearchResponse>(url, {
      params: {
        code: options.code,
        brand: options.brand,
        with_non_returnable: withNonReturnable,
        with_offers: withOffers,
      },
      headers,
      timeout: MAX_TIMEOUT_MS,
    });

    const data = response.data;

    if (isErrorResponse(data)) {
      logger.warn('[turboCars] Бизнес-ошибка при запросе /offers:search', {
        error_code: (data as any).error_code,
        error_message: (data as any).error_message,
      });
      return null;
    }

    if (!data || !Array.isArray(data.offers)) {
      logger.warn('[turboCars] Некорректный ответ /offers:search', {
        keys: data ? Object.keys(data as any) : [],
      });
      return null;
    }

    return data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axErr = error as AxiosError<any>;
      const status = axErr.response?.status;
      const body = axErr.response?.data;

      if (status && status >= 400 && status < 500 && isErrorResponse(body)) {
        logger.warn('[turboCars] HTTP 4xx при запросе /offers:search', {
          status,
          error_code: body.error_code,
          error_message: body.error_message,
        });
        return null;
      }
    }

    logger.error('[turboCars] Ошибка сети при запросе /offers:search', error);
    throw error;
  }
};


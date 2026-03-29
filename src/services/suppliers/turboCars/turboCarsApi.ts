import axios, { AxiosError } from 'axios';
import { Logger } from 'winston';

import {
  TurboCarsBrandSearchResponse,
  TurboCarsBrandSearchSuccess,
  TurboCarsErrorResponse,
  TurboCarsOffersSearchResponse,
  TurboCarsOffersSearchSuccess,
  TurboCarsOrderCreateBadOffer,
  TurboCarsOrderCreatePosition,
  TurboCarsOrderCreateRequest,
  TurboCarsOrderCreateResponse,
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

/**
 * Извлекает читаемое сообщение из структурированной ошибки TurboCars.
 * error_message может быть строкой (по Swagger) или объектом { description }.
 */
const extractErrorMessage = (resp: TurboCarsErrorResponse): string => {
  const em = resp.error_message as unknown;
  if (typeof em === 'string') return em;
  if (em && typeof em === 'object' && 'description' in em) {
    return (em as { description: string }).description;
  }
  return JSON.stringify(em);
};

/**
 * Разбор и проверка тела успешного ответа POST /order:create.
 * HTTP 200 без полей контракта не должен приводить к «успешному» чекауту в нашей БД.
 */
const parseOrderCreateSuccessBody = (data: unknown): TurboCarsOrderCreateResponse => {
  if (!data || typeof data !== 'object') {
    throw new Error(
      'Некорректный ответ TurboCars /order:create: ожидался объект JSON',
    );
  }

  const raw = data as Record<string, unknown>;
  const orderNumberRaw = raw.order_number;

  if (typeof orderNumberRaw !== 'string' || orderNumberRaw.trim() === '') {
    throw new Error(
      'Некорректный ответ TurboCars /order:create: отсутствует или пустой order_number',
    );
  }

  const isTestVal = raw.is_test;
  if (isTestVal !== 0 && isTestVal !== 1) {
    throw new Error(
      'Некорректный ответ TurboCars /order:create: поле is_test должно быть 0 или 1',
    );
  }

  let badOffers: TurboCarsOrderCreateBadOffer[] | undefined;

  if (raw.bad_offers !== undefined && raw.bad_offers !== null) {
    if (!Array.isArray(raw.bad_offers)) {
      throw new Error(
        'Некорректный ответ TurboCars /order:create: bad_offers должен быть массивом',
      );
    }

    badOffers = raw.bad_offers.map((entry, index) => {
      if (!entry || typeof entry !== 'object') {
        throw new Error(
          `Некорректный ответ TurboCars /order:create: bad_offers[${index}] не объект`,
        );
      }
      const b = entry as Record<string, unknown>;
      const { code, brand, reason } = b;
      if (typeof code !== 'string' || typeof brand !== 'string' || typeof reason !== 'string') {
        throw new Error(
          `Некорректный ответ TurboCars /order:create: bad_offers[${index}] — ожидаются строки code, brand, reason`,
        );
      }
      return { code, brand, reason };
    });
  }

  return {
    order_number: orderNumberRaw.trim(),
    is_test: isTestVal,
    ...(badOffers !== undefined && badOffers.length > 0 ? { bad_offers: badOffers } : {}),
  };
};

export const createTurboCarsOrder = async (
  positions: TurboCarsOrderCreatePosition[],
  logger: Logger,
  isTest: 0 | 1 = 0,
): Promise<TurboCarsOrderCreateResponse> => {
  const { urlBase, headers } = createTurboCarsClientConfig();
  const url = `${urlBase}/order:create`;

  const body: TurboCarsOrderCreateRequest = {
    is_test: isTest,
    positions,
  };

  try {
    const response = await axios.post<
      TurboCarsOrderCreateResponse | TurboCarsErrorResponse
    >(url, body, {
      headers: { ...headers, 'Content-Type': 'application/json' },
      timeout: MAX_TIMEOUT_MS,
    });

    const data = response.data;

    if (isErrorResponse(data)) {
      const msg = extractErrorMessage(data as TurboCarsErrorResponse);
      throw new Error(`TurboCars: ${(data as TurboCarsErrorResponse).error_code} — ${msg}`);
    }

    logger.debug('[turboCars] Ответ поставщика POST /order:create', {
      responseBody: data,
    });

    const parsed = parseOrderCreateSuccessBody(data);

    if (parsed.is_test !== isTest) {
      logger.warn('[turboCars] Ответ /order:create: is_test не совпадает с телом запроса', {
        requested: isTest,
        received: parsed.is_test,
      });
    }

    return parsed;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axErr = error as AxiosError<unknown>;
      const status = axErr.response?.status;
      const respBody = axErr.response?.data;

      if (status && status >= 400 && isErrorResponse(respBody)) {
        const msg = extractErrorMessage(respBody as TurboCarsErrorResponse);
        logger.warn('[turboCars] HTTP ошибка при запросе /order:create', {
          status,
          error_code: (respBody as TurboCarsErrorResponse).error_code,
          error_message: msg,
        });
        throw new Error(`TurboCars ${status}: ${(respBody as TurboCarsErrorResponse).error_code} — ${msg}`);
      }
    }

    logger.error('[turboCars] Ошибка сети при запросе /order:create', error);
    throw error;
  }
};


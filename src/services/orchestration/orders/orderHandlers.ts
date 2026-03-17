import { Logger } from 'winston';
import { AbcpSupplierAlias } from '../../platforms/abcp/abcpPlatform.types.js';
import { mapAbcpOrdersToUnified } from '../../platforms/abcp/api/abcpOrdersMapper.js';
import { fetchAbcpOrders } from '../../platforms/abcp/api/fetchAbcpOrders.js';
import { mapAutosputnikOrdersToUnified } from '../../suppliers/autosputnik/orders/autosputnikOrdersMapper.js';
import { fetchAutosputnikOrders } from '../../suppliers/autosputnik/orders/fetchAutosputnikOrders.js';
import { fetchProfitOrders } from '../../suppliers/profit/orders/fetchProfitOrders.js';
import { mapProfitOrdersToUnified } from '../../suppliers/profit/orders/profitMapper.js';
import { fetchTurboCarsOrders } from '../../suppliers/turboCars/fetchTurboCarsOrders.js';
import { mapTurboCarsOrdersToUnified } from '../../suppliers/turboCars/turboCarsMapper.js';
import { UnifiedOrderItem } from './orders.types.js';

import { parseOrdersHtml } from '../../platforms/abcp/parser/parseOrdersHtml.js';
import {
  AbcpRequestOptions,
  fetchOrdersHtml,
  IAbcpClientWrapper,
  SupplierConfigABCP,
} from '../../platforms/abcp/parser/fetchOrdersHtml.js';

import { abcpHeaders } from '../../../constants/headers.js';
import { autoImpulseClient } from '../../suppliers/autoImpulse/client.js';
import { mikanoClient } from '../../suppliers/mikano/client.js';
import { fetchAvtoPartnerOrders } from '../../suppliers/avtopartner/ordersAvtoPartnerService.js';

// --- Types ---

/**
 * signal (AbortSignal) — позволяет воркеру каскадно прерывать HTTP-запросы
 * при таймауте поставщика или abort stale-цикла.
 * Каждый fetcher должен пробрасывать signal в axios config ({ signal }).
 */
type OrderHandler = (logger: Logger, targetSyncDate: Date, signal?: AbortSignal) => Promise<UnifiedOrderItem[]>;
type FetcherStrategy<T> = (logger: Logger, targetSyncDate: Date, signal?: AbortSignal) => Promise<T>;
type MapperStrategy<T> = (data: T) => UnifiedOrderItem[];

// --- 1. Functional Middleware (Monitoring & Error Handling) ---

/**
 * Обертка высшего порядка (HOF) для стандартизации логов и обработки ошибок.
 * Убирает дублирование try-catch и logger.info из каждого хендлера.
 */
const withMonitoring = (
  alias: string,
  fn: OrderHandler
): OrderHandler => {
  return async (logger: Logger, targetSyncDate: Date, signal?: AbortSignal) => {
    logger.debug(`[${alias}] Starting fetch...`, { supplier: alias, targetSyncDate: targetSyncDate.toISOString() });
    try {
      const result = await fn(logger, targetSyncDate, signal);
      logger.info(`[${alias}] Fetched ${result.length} orders`, {
        supplier: alias,
        count: result.length,
      });
      return result;
    } catch (error) {
      logger.error(`[${alias}] Fetch failed`, { supplier: alias, error });
      throw error;
    }
  };
};

/**
 * Фабрика для создания простого API-хендлера.
 * Разделяет получение данных (Side Effect) и их преобразование (Pure Function).
 */
const createApiHandler = <T>(
  alias: string,
  fetcher: FetcherStrategy<T>,
  mapper: MapperStrategy<T>
): OrderHandler => {
  const handler: OrderHandler = async (logger, targetSyncDate, signal) => {
    const rawData = await fetcher(logger, targetSyncDate, signal);
    return mapper(rawData);
  };
  return withMonitoring(alias, handler);
};

// --- 2. Parsing Logic Isolation ---

interface ParserConfig {
  alias: string;
  client: IAbcpClientWrapper;
  serviceConfig: SupplierConfigABCP;
  paginationStrategy: 'allow' | 'block_subsequent_pages';
}

/**
 * Создает прокси-клиент для перехвата запросов.
 * Явно выделяем логику блокировки пагинации и инъекции заголовков.
 * Signal прозрачно прокидывается из options в baseClient.
 */
const createConfiguredClient = (
  baseClient: IAbcpClientWrapper,
  strategy: ParserConfig['paginationStrategy']
): IAbcpClientWrapper => {
  return {
    makeRequest: async (url, options: AbcpRequestOptions = {}) => {
      // Logic Guard: Блокируем запросы глубже первой страницы для flat-листов
      if (
        strategy === 'block_subsequent_pages' &&
        Number(options.params?.start ?? 0) > 0
      ) {
        return {
          data: '',
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        };
      }

      const mergedHeaders = { ...abcpHeaders, ...(options.headers || {}) };
      return baseClient.makeRequest(url, {
        ...options,
        headers: mergedHeaders,
      });
    },
  };
};

const createParserHandler = (config: ParserConfig): OrderHandler => {
  const smartClient = createConfiguredClient(
    config.client,
    config.paginationStrategy
  );

  const service = fetchOrdersHtml(smartClient, parseOrdersHtml);

  const handler: OrderHandler = async (logger, targetSyncDate, signal) => {
    return service.syncSupplier(config.serviceConfig, logger, targetSyncDate, signal);
  };

  return withMonitoring(config.alias, handler);
};

// --- 3. Configurations ---

// API Handlers
const createAbcp = (alias: AbcpSupplierAlias) =>
  createApiHandler(
    alias,
    (_logger, targetSyncDate, signal) => fetchAbcpOrders(alias, { format: 'p' }, targetSyncDate, signal),
    (data) => mapAbcpOrdersToUnified(data, alias)
  );

const createAutosputnik = (alias: 'autosputnik' | 'autosputnik_bn') =>
  createApiHandler(
    alias,
    (logger, targetSyncDate, signal) => fetchAutosputnikOrders(alias, logger, targetSyncDate, signal),
    (data) => mapAutosputnikOrdersToUnified(data, alias)
  );

const createProfit = () =>
  createApiHandler(
    'profit',
    (logger, targetSyncDate, signal) => fetchProfitOrders(logger, targetSyncDate, signal),
    (data) => mapProfitOrdersToUnified(data, 'profit')
  );

const createTurboCars = () =>
  createApiHandler(
    'turboCars',
    (logger, targetSyncDate, signal) => fetchTurboCarsOrders(logger, targetSyncDate, signal),
    (data) => mapTurboCarsOrdersToUnified(data, 'turboCars')
  );

// Parsing Handlers
const mikanoHandler = createParserHandler({
  alias: 'mikano',
  client: mikanoClient,
  paginationStrategy: 'allow',
  serviceConfig: {
    key: 'mikano',
    baseUrl: `${process.env.MIKANO_LOGIN_URL}orders`,
    queryType: 'nested',
    historyDays: 90,
  },
});

const autoImpulseHandler = createParserHandler({
  alias: 'autoImpulse',
  client: autoImpulseClient,
  paginationStrategy: 'block_subsequent_pages',
  serviceConfig: {
    key: 'autoImpulse',
    baseUrl: process.env.AUTOIMPULSE_ORDERS_URL!,
    queryType: 'flat',
    historyDays: 90,
  },
});

const avtoPartnerHandler = withMonitoring(
  'avtoPartner',
  (logger, targetSyncDate, signal) => fetchAvtoPartnerOrders(logger, targetSyncDate, signal)
);

// --- Exports ---

export const orderHandlers: Record<string, OrderHandler> = {
  // ABCP API
  ug: createAbcp('ug'),
  ug_bn: createAbcp('ug_bn'),
  patriot: createAbcp('patriot'),
  npn: createAbcp('npn'),
  avtodinamika: createAbcp('avtodinamika'),

  // Other APIs
  autosputnik: createAutosputnik('autosputnik'),
  autosputnik_bn: createAutosputnik('autosputnik_bn'),
  profit: createProfit(),
  turboCars: createTurboCars(),

  // HTML Parsers
  mikano: mikanoHandler,
  autoImpulse: autoImpulseHandler,
  avtoPartner: avtoPartnerHandler,
};

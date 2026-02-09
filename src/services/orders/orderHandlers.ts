import { Logger } from 'winston';
import { AbcpSupplierAlias } from '../abcp/abcpPlatform.types.js';
import { mapAbcpOrdersToUnified } from '../abcp/api/abcpOrdersMapper.js';
import { fetchAbcpOrders } from '../abcp/api/fetchAbcpOrders.js';
import { mapAutosputnikOrdersToUnified } from '../autosputnik/orders/autosputnikOrdersMapper.js';
import { fetchAutosputnikOrders } from '../autosputnik/orders/fetchAutosputnikOrders.js';
import { fetchProfitOrders } from '../profit/orders/fetchProfitOrders.js';
import { mapProfitOrdersToUnified } from '../profit/orders/profitMapper.js';
import { UnifiedOrderItem } from './orders.types.js';

import { parseAbcpHtml } from '../abcp/parser/AbcpOrderParser.js';
import {
  createAbcpOrderService,
  IAbcpClientWrapper,
  SupplierConfigABCP,
} from '../abcp/parser/abcpOrderServiceParser.js';

import { ugHeaders } from '../../constants/headers.js';
import { autoImpulseClient, mikanoClient } from '../abcp/parser/index.js';

// --- Types ---

type OrderHandler = (logger: Logger) => Promise<UnifiedOrderItem[]>;
type FetcherStrategy<T> = (logger: Logger) => Promise<T>;
type MapperStrategy<T> = (data: T) => UnifiedOrderItem[];

// --- 1. Functional Middleware (Monitoring & Error Handling) ---

/**
 * Обертка высшего порядка (HOF) для стандартизации логов и обработки ошибок.
 * Убирает дублирование try-catch и logger.info из каждого хендлера.
 */
const withMonitoring = (
  alias: string,
  fn: (logger: Logger) => Promise<UnifiedOrderItem[]>
): OrderHandler => {
  return async (logger: Logger) => {
    logger.debug(`[${alias}] Starting fetch...`, { supplier: alias });
    try {
      const result = await fn(logger);
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
  const handler = async (logger: Logger) => {
    const rawData = await fetcher(logger);
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
 */
const createConfiguredClient = (
  baseClient: IAbcpClientWrapper,
  strategy: ParserConfig['paginationStrategy']
): IAbcpClientWrapper => {
  return {
    makeRequest: async (url, options = {}) => {
      // Logic Guard: Блокируем запросы глубже первой страницы для flat-листов
      if (
        strategy === 'block_subsequent_pages' &&
        (options.params?.start ?? 0) > 0
      ) {
        return {
          data: '', // Empty HTML response
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        };
      }

      // Header Injection
      const mergedHeaders = { ...ugHeaders, ...(options.headers || {}) };
      return baseClient.makeRequest(url, {
        ...options,
        headers: mergedHeaders,
      });
    },
  };
};

const createParserHandler = (config: ParserConfig): OrderHandler => {
  // Dependency Injection:
  const smartClient = createConfiguredClient(
    config.client,
    config.paginationStrategy
  );

  // ВАЖНО: Мы больше не делаем new AbcpOrderParser().
  // Мы передаем функцию parseAbcpHtml прямо в фабрику.
  const service = createAbcpOrderService(smartClient, parseAbcpHtml);

  const handler = async (logger: Logger) => {
    return service.syncSupplier(config.serviceConfig, logger);
  };

  return withMonitoring(config.alias, handler);
};

// --- 3. Configurations ---

// API Handlers
const createAbcp = (alias: AbcpSupplierAlias) =>
  createApiHandler(
    alias,
    () => fetchAbcpOrders(alias, { format: 'p' }),
    (data) => mapAbcpOrdersToUnified(data, alias)
  );

const createAutosputnik = (alias: 'autosputnik' | 'autosputnik_bn') =>
  createApiHandler(
    alias,
    (logger) => fetchAutosputnikOrders(alias, logger),
    (data) => mapAutosputnikOrdersToUnified(data, alias)
  );

const createProfit = () =>
  createApiHandler(
    'profit',
    (logger) => fetchProfitOrders(logger),
    (data) => mapProfitOrdersToUnified(data, 'profit')
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
    historyDays: 60,
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
    historyDays: 60,
  },
});

// --- Exports ---

export const orderHandlers: Record<string, OrderHandler> = {
  // ABCP API
  ug: createAbcp('ug'),
  ug_f: createAbcp('ug_f'),
  ug_bn: createAbcp('ug_bn'),
  patriot: createAbcp('patriot'),
  npn: createAbcp('npn'),
  avtodinamika: createAbcp('avtodinamika'),

  // Other APIs
  autosputnik: createAutosputnik('autosputnik'),
  autosputnik_bn: createAutosputnik('autosputnik_bn'),
  profit: createProfit(),

  // HTML Parsers
  mikano: mikanoHandler,
  autoImpulse: autoImpulseHandler,
};

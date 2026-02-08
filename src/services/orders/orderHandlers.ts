import { Logger } from 'winston';
import { AbcpSupplierAlias } from '../abcp/abcpPlatform.types.js';
import { mapAbcpOrdersToUnified } from '../abcp/api/abcpOrdersMapper.js';
import { fetchAbcpOrders } from '../abcp/api/fetchAbcpOrders.js';
import { mapAutosputnikOrdersToUnified } from '../autosputnik/orders/autosputnikOrdersMapper.js';
import { fetchAutosputnikOrders } from '../autosputnik/orders/fetchAutosputnikOrders.js';
import { fetchProfitOrders } from '../profit/orders/fetchProfitOrders.js';
import { mapProfitOrdersToUnified } from '../profit/orders/profitMapper.js';
import { UnifiedOrderItem } from './orders.types.js';

import { AbcpOrderParser } from '../abcp/parser/AbcpOrderParser.js';
import {
  abcpOrderServiceParser,
  IAbcpClientWrapper,
  SupplierConfigABCP,
} from '../abcp/parser/abcpOrderServiceParser.js';

// !!! ИМПОРТИРУЕМ СИНГЛТОНЫ КЛИЕНТОВ, А НЕ СОЗДАЕМ ИХ ЗАНОВО !!!
// Путь зависит от того, где лежит твой index.ts с экспортами.
// Предполагаю: src/services/abcp/parser/index.ts (или где у тебя лежит index.ts с клиентами)
import { ugHeaders } from '../../constants/headers.js';
import { autoImpulseClient, mikanoClient } from '../abcp/parser/index.js';

// Хендлер ожидает logger для контекстного логирования
type OrderHandler = (logger: Logger) => Promise<UnifiedOrderItem[]>;

// --- Фабрики API (существующие) ---
const createAbcpOrderHandler = (alias: AbcpSupplierAlias): OrderHandler => {
  return async (logger: Logger) => {
    logger.debug(`[${alias}] Starting ABCP fetch...`, { supplier: alias });
    try {
      const rawData = await fetchAbcpOrders(alias, { format: 'p' });
      const mapped = mapAbcpOrdersToUnified(rawData, alias);
      logger.info(`[${alias}] Fetched ${mapped.length} orders`, {
        supplier: alias,
        count: mapped.length,
      });
      return mapped;
    } catch (error) {
      logger.error(`[${alias}] ABCP fetch failed`, { supplier: alias, error });
      throw error;
    }
  };
};

const createAutosputnikHandler = (
  alias: 'autosputnik' | 'autosputnik_bn'
): OrderHandler => {
  return async (logger: Logger) => {
    logger.debug(`[${alias}] Starting Autosputnik fetch...`, {
      supplier: alias,
    });
    const rawData = await fetchAutosputnikOrders(alias, logger);
    const mapped = mapAutosputnikOrdersToUnified(rawData, alias);
    logger.info(`[${alias}] Fetched ${mapped.length} orders`, {
      supplier: alias,
      count: mapped.length,
    });
    return mapped;
  };
};

const createProfitHandler = (): OrderHandler => {
  return async (logger: Logger) => {
    const alias = 'profit';
    logger.debug(`[${alias}] Starting Profit fetch...`, { supplier: alias });
    const rawData = await fetchProfitOrders(logger);
    const mapped = mapProfitOrdersToUnified(rawData, alias);
    logger.info(`[${alias}] Fetched ${mapped.length} orders`, {
      supplier: alias,
      count: mapped.length,
    });
    return mapped;
  };
};

// --- Новая Фабрика для парсинга HTML ---

interface ParsingHandlerConfig {
  client: IAbcpClientWrapper; // Теперь принимаем готовый инстанс
  serviceConfig: SupplierConfigABCP;
  disablePagination?: boolean; // Флаг для поставщиков, отдающих всё одной страницей
}

const createParsingOrderHandler = (
  config: ParsingHandlerConfig
): OrderHandler => {
  // 1. Создаем прокси-клиента.
  const clientWithHeaders: IAbcpClientWrapper = {
    makeRequest: async (url, options = {}) => {
      // INTERCEPTION:
      // Если отключена пагинация и сервис запрашивает следующую страницу (start > 0),
      // мы принудительно возвращаем пустой ответ.
      // Это предотвращает бесконечный цикл для поставщиков типа AutoImpulse.
      if (config.disablePagination && options.params?.start > 0) {
        return {
          data: '', // Пустой HTML
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {} as any,
        };
      }

      // Иначе делаем реальный запрос
      const headers = {
        ...ugHeaders,
        ...(options.headers || {}),
      };
      return config.client.makeRequest(url, { ...options, headers });
    },
  };

  // 2. Инициализация парсера
  const parser = new AbcpOrderParser();

  // 3. Инициализация сервиса (DI)
  // Передаем нашего "умного" клиента
  const service = new abcpOrderServiceParser(clientWithHeaders, parser);

  return async (logger: Logger) => {
    return service.syncSupplier(config.serviceConfig, logger);
  };
};

// --- Конфигурация Хендлеров ---

// Mikano Config
const mikanoHandler = createParsingOrderHandler({
  client: mikanoClient, // Используем импортированный клиент
  serviceConfig: {
    key: 'mikano',
    baseUrl: `${(process.env.MIKANO_LOGIN_URL || '').replace(/\/+$/, '')}/orders`,
    queryType: 'nested',
    historyDays: 60,
  },
  disablePagination: false, // У Mikano есть пагинация
});

// AutoImpulse Config
const autoImpulseHandler = createParsingOrderHandler({
  client: autoImpulseClient, // Используем импортированный клиент
  serviceConfig: {
    key: 'autoImpulse',
    // ХАК: Вшиваем обязательные параметры фильтрации прямо в URL.
    baseUrl:
      'https://lnr-auto-impulse.ru/orders?id_order=-1&allOrders=1&paymentTypeId=0&accurateCodeSearch=on',
    queryType: 'flat',
    historyDays: 60,
  },
  disablePagination: true, // ВАЖНО: AutoImpulse отдает все заказы сразу. Отключаем цикл.
});

// --- Экспорт Хендлеров ---

export const orderHandlers: Record<string, OrderHandler> = {
  // --- ABCP (API) ---
  ug: createAbcpOrderHandler('ug'),
  ug_f: createAbcpOrderHandler('ug_f'),
  ug_bn: createAbcpOrderHandler('ug_bn'),
  patriot: createAbcpOrderHandler('patriot'),
  npn: createAbcpOrderHandler('npn'),
  avtodinamika: createAbcpOrderHandler('avtodinamika'),

  // --- Non-ABCP (API) ---
  autosputnik: createAutosputnikHandler('autosputnik'),
  autosputnik_bn: createAutosputnikHandler('autosputnik_bn'),
  profit: createProfitHandler(),

  // --- Non-ABCP (Parsing) ---
  mikano: mikanoHandler,
  autoImpulse: autoImpulseHandler,
};

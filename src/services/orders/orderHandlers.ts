import { Logger } from 'winston';
import { AbcpSupplierAlias } from '../abcp/abcpPlatform.types.js';
import { mapAbcpOrdersToUnified } from '../abcp/api/abcpOrdersMapper.js';
import { fetchAbcpOrders } from '../abcp/api/fetchAbcpOrders.js';
import { mapAutosputnikOrdersToUnified } from '../autosputnik/orders/autosputnikOrdersMapper.js';
import { fetchAutosputnikOrders } from '../autosputnik/orders/fetchAutosputnikOrders.js';
import { UnifiedOrderItem } from './orders.types.js';

// ИЗМЕНЕНИЕ: Хендлер теперь ожидает logger для контекстного логирования
type OrderHandler = (logger: Logger) => Promise<UnifiedOrderItem[]>;

/**
 * Фабрика для создания хендлеров ABCP.
 */
const createAbcpOrderHandler = (alias: AbcpSupplierAlias): OrderHandler => {
  return async (logger: Logger) => {
    // Логируем начало запроса с контекстом
    logger.debug(`[${alias}] Starting ABCP fetch...`, { supplier: alias });

    try {
      // format: 'p' обязателен, чтобы получить массив позиций внутри заказа
      // TODO: В будущем добавить logger внутрь fetchAbcpOrders для детальной отладки
      const rawData = await fetchAbcpOrders(alias, { format: 'p' });

      const mapped = mapAbcpOrdersToUnified(rawData, alias);
      logger.info(`[${alias}] Fetched ${mapped.length} orders`, {
        supplier: alias,
        count: mapped.length,
      });

      return mapped;
    } catch (error) {
      logger.error(`[${alias}] ABCP fetch failed`, { supplier: alias, error });
      throw error; // Пробрасываем ошибку, чтобы Promise.allSettled записал её в rejected
    }
  };
};

/**
 * Фабрика для Autosputnik (API)
 */
const createAutosputnikHandler = (
  alias: 'autosputnik' | 'autosputnik_bn'
): OrderHandler => {
  return async (logger: Logger) => {
    logger.debug(`[${alias}] Starting Autosputnik fetch...`, {
      supplier: alias,
    });

    // Передаем logger внутрь, так как мы обновили fetchAutosputnikOrders
    const rawData = await fetchAutosputnikOrders(alias, logger);

    const mapped = mapAutosputnikOrdersToUnified(rawData, alias);
    logger.info(`[${alias}] Fetched ${mapped.length} orders`, {
      supplier: alias,
      count: mapped.length,
    });

    return mapped;
  };
};

export const orderHandlers: Record<string, OrderHandler> = {
  // --- ABCP Поставщики ---
  ug: createAbcpOrderHandler('ug'),
  ug_f: createAbcpOrderHandler('ug_f'),
  ug_bn: createAbcpOrderHandler('ug_bn'),
  patriot: createAbcpOrderHandler('patriot'),
  npn: createAbcpOrderHandler('npn'),
  avtodinamika: createAbcpOrderHandler('avtodinamika'),

  // --- API (Non-ABCP) ---
  autosputnik: createAutosputnikHandler('autosputnik'),
  autosputnik_bn: createAutosputnikHandler('autosputnik_bn'),

  // --- Парсеры (Non-ABCP) ---
  // profit: ...
};

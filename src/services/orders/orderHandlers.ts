import { fetchAbcpOrders } from '../abcp/api/fetchAbcpOrders.js';
import { UnifiedOrderItem } from './orders.types.js';
import { AbcpSupplierAlias } from '../abcp/abcpPlatform.types.js';
import { mapAbcpOrdersToUnified } from '../abcp/api/abcpOrdersMapper.js';

// Тип функции-хендлера
type OrderHandler = () => Promise<UnifiedOrderItem[]>;

/**
 * Фабрика для создания хендлеров ABCP.
 * Позволяет не писать один и тот же код для каждого поставщика.
 */
const createAbcpOrderHandler = (alias: AbcpSupplierAlias): OrderHandler => {
  return async () => {
    // format: 'p' обязателен, чтобы получить массив позиций внутри заказа
    const rawData = await fetchAbcpOrders(alias, { format: 'p' });
    return mapAbcpOrdersToUnified(rawData, alias);
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

  // --- Парсеры (Non-ABCP) ---
  // autoImpulse: async () => { ... },
  // mikano: async () => { ... },
  // profit: async () => { ... },
  // armtek: async () => { ... },
};

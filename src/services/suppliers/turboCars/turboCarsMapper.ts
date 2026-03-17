import { OrderStatus, UnifiedOrderItem } from '../../orchestration/orders/orders.types.js';
import type { TurboCarsOrderRaw, TurboCarsPositionRaw } from './turboCars.types.js';

/**
 * Безопасный парсер числовых значений из TurboCars.
 * Принимает число, строку с пробелами/запятой или null/undefined
 * и гарантированно возвращает number.
 */
const parseTurboCarsNumber = (value: number | string | null | undefined): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    const normalized = trimmed.replace(/\s+/g, '').replace(',', '.');
    const parsed = Number.parseFloat(normalized);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

/**
 * Строгий маппинг ID статусов TurboCars → наш OrderStatus.
 *
 * Основан на переданной таблице соответствий:
 * - 2 (Принято) -> 'pending'
 * - 4 (Заказано) -> 'work'
 * - 6, 7, 8, 10 (Прибыло/Упаковано/Отправлено в РЦ) -> 'shipping'
 * - 11, 12 (Отправлено/Доставлено клиенту) -> 'finished'
 * - 5, 14, 15 (Снято/Возврат/Отказ) -> 'refused'
 * - 13, 16 -> выбрано 'unknown', т.к. semantics неочевидна.
 */
const statusMap: Record<number, OrderStatus> = {
  2: 'pending',
  4: 'work',
  6: 'shipping',
  7: 'shipping',
  8: 'shipping',
  10: 'shipping',
  11: 'finished',
  12: 'finished',
  5: 'refused',
  14: 'refused',
  15: 'refused',
  13: 'unknown',
  16: 'unknown',
};

const mapStatusIdToOrderStatus = (statusId: number | null | undefined): OrderStatus => {
  if (typeof statusId !== 'number') {
    return 'unknown';
  }
  return statusMap[statusId] ?? 'unknown';
};

const pickCreatedAt = (order: TurboCarsOrderRaw, position: TurboCarsPositionRaw): string => {
  // order.created_at не описан в схеме API, но может приходить в ответе
  const created = (order as { created_at?: string | null }).created_at;
  if (created) return created;
  if (position.delivery_date_time_start) return position.delivery_date_time_start;
  if (position.delivery_date_time_end) return position.delivery_date_time_end;
  return '';
};

export const mapTurboCarsOrdersToUnified = (
  rawData: TurboCarsOrderRaw[],
  supplierAlias: string
): UnifiedOrderItem[] => {
  if (!Array.isArray(rawData) || rawData.length === 0) {
    return [];
  }

  const result: UnifiedOrderItem[] = [];

  for (const order of rawData) {
    if (!order || !Array.isArray(order.positions) || order.positions.length === 0) {
      continue;
    }

    for (const pos of order.positions) {
      const quantity = parseTurboCarsNumber(pos.count);
      const price = parseTurboCarsNumber(pos.price);
      const totalPrice = price * quantity;

      const status: OrderStatus = mapStatusIdToOrderStatus(pos.status_id);

      const createdAt = pickCreatedAt(order, pos);
      const deliveryDate =
        pos.delivery_date_time_end ?? pos.delivery_date_time_start ?? undefined;

      const item: UnifiedOrderItem = {
        id: String(pos.id),
        orderId: String(order.order_number),
        supplier: supplierAlias,

        brand: pos.brand || '',
        article: pos.code || '',
        name: pos.name || '',

        quantity,
        price,
        totalPrice,
        currency: 'RUB',

        status,
        statusRaw: pos.status || String(pos.status_id ?? ''),

        createdAt,
        deliveryDate: deliveryDate || undefined,
        comment: pos.comment ?? undefined,
      };

      result.push(item);
    }
  }

  return result;
};


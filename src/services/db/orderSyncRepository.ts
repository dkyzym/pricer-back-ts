import { Order } from '../../models/Order.js';
import type { UnifiedOrderItem } from '../orders/orders.types.js';
import { logger } from '../../config/logger/index.js';

function toValidDate(value: string | Date | undefined | null): Date | undefined {
  if (value == null) return undefined;
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
}

/**
 * Синхронизирует пакет заказов в БД через bulkWrite (updateOne + upsert).
 * @param orders — массив нормализованных заказов (результат парсеров)
 * @param rawProviderDataMap — опциональный маппинг id → сырые данные поставщика
 * @returns результат bulkWrite (upsertedCount, modifiedCount и т.д.)
 */
export async function syncOrdersBatch(
  orders: UnifiedOrderItem[],
  rawProviderDataMap?: Map<string, Record<string, unknown>>
): Promise<{
  insertedCount: number;
  upsertedCount: number;
  matchedCount: number;
  modifiedCount: number;
  deletedCount: number;
  upsertedIds: Record<number, unknown>;
}> {
  if (orders.length === 0) {
    logger.info('[orderSyncRepository] syncOrdersBatch: пустой массив, пропуск');
    return {
      insertedCount: 0,
      upsertedCount: 0,
      matchedCount: 0,
      modifiedCount: 0,
      deletedCount: 0,
      upsertedIds: {},
    };
  }

  const operations = orders.map((order) => {
    const providerCreatedAt = toValidDate(order.createdAt) ?? new Date();

    const setDoc: Record<string, unknown> = {
      id: order.id,
      orderId: order.orderId,
      supplier: order.supplier,
      brand: order.brand,
      article: order.article,
      name: order.name,
      quantity: order.quantity,
      price: order.price,
      totalPrice: order.totalPrice,
      currency: order.currency,
      status: order.status,
      statusRaw: order.statusRaw,
      providerCreatedAt,
    };

    const deliveryDate = toValidDate(order.deliveryDate as string | Date | undefined);
    if (deliveryDate != null) {
      setDoc.deliveryDate = deliveryDate;
    }

    if (order.comment != null) {
      setDoc.comment = order.comment;
    }

    if (rawProviderDataMap) {
      const raw = rawProviderDataMap.get(`${order.supplier}_${order.id}`);
      if (raw != null) {
        setDoc.rawProviderData = raw as Record<string, unknown>;
      }
    }

    return {
      updateOne: {
        filter: { supplier: order.supplier, id: order.id },
        update: {
          $set: setDoc,
        },
        upsert: true,
      },
    };
  });

  try {
    const result = await Order.bulkWrite(operations);

    const upserted = result.upsertedCount;
    const modified = result.modifiedCount;

    logger.info('[orderSyncRepository] syncOrdersBatch завершён', {
      total: orders.length,
      upserted,
      modified,
      matched: result.matchedCount,
    });

    return result;
  } catch (err) {
    logger.error('[orderSyncRepository] syncOrdersBatch ошибка', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      ordersCount: orders.length,
    });
    throw err;
  }
}

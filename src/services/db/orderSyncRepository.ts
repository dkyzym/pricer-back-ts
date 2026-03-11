import { logger } from '../../config/logger/index.js';
import { Order } from '../../models/Order.js';
import type { UnifiedOrderItem } from '../orders/orders.types.js';

/** Размер чанка для bulkWrite — баланс между throughput и нагрузкой на Event Loop */
const BULK_WRITE_CHUNK_SIZE = 500;

const toValidDate = (value: string | Date | undefined | null): Date | undefined => {
  if (value == null) return undefined;
  const d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
};

/**
 * Синхронизирует пакет заказов в БД через bulkWrite (updateOne + upsert).
 * Обработка идёт чанками по BULK_WRITE_CHUNK_SIZE записей, чтобы не блокировать
 * Event Loop сериализацией гигантского BSON-документа и не держать огромные
 * массивы операций в памяти.
 *
 * providerCreatedAt: при отсутствии валидной даты от поставщика используется
 * $setOnInsert — fallback-дата (new Date()) выставляется только при создании
 * документа и не перезаписывается при последующих обновлениях.
 *
 * ordered: false — операции внутри чанка выполняются параллельно, и сбой
 * одной операции не останавливает остальные.
 */
export const syncOrdersBatch = async (
  orders: UnifiedOrderItem[],
  rawProviderDataMap?: Map<string, Record<string, unknown>>
): Promise<{
  insertedCount: number;
  upsertedCount: number;
  matchedCount: number;
  modifiedCount: number;
  deletedCount: number;
  upsertedIds: Record<number, unknown>;
}> => {
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

  const totals = {
    insertedCount: 0,
    upsertedCount: 0,
    matchedCount: 0,
    modifiedCount: 0,
    deletedCount: 0,
    upsertedIds: {} as Record<number, unknown>,
  };

  for (let offset = 0; offset < orders.length; offset += BULK_WRITE_CHUNK_SIZE) {
    const chunk = orders.slice(offset, offset + BULK_WRITE_CHUNK_SIZE);

    const operations = chunk.map((order) => {
      const providerCreatedAt = toValidDate(order.createdAt);

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
      };

      /**
       * $set vs $setOnInsert для providerCreatedAt:
       * — Валидная дата от поставщика → $set (обновляем всегда, поставщик мог скорректировать).
       * — Дата отсутствует → $setOnInsert с fallback new Date(), чтобы не затирать
       *   реальную дату при каждом цикле синхронизации.
       */
      const update: Record<string, unknown> = { $set: setDoc };

      if (providerCreatedAt) {
        setDoc.providerCreatedAt = providerCreatedAt;
      } else {
        update.$setOnInsert = { providerCreatedAt: new Date() };
      }

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
          setDoc.rawProviderData = raw;
        }
      }

      return {
        updateOne: {
          filter: { supplier: order.supplier, id: order.id },
          update,
          upsert: true,
        },
      };
    });

    try {
      logger.debug(`[DB] Starting bulkWrite for chunk of ${chunk.length} items`);
      const result = await Order.bulkWrite(operations, { ordered: false });
      logger.debug(`[DB] Finished bulkWrite`);

      totals.insertedCount += result.insertedCount;
      totals.upsertedCount += result.upsertedCount;
      totals.matchedCount += result.matchedCount;
      totals.modifiedCount += result.modifiedCount;
      totals.deletedCount += result.deletedCount;

      for (const [localIdx, id] of Object.entries(result.upsertedIds ?? {})) {
        totals.upsertedIds[offset + Number(localIdx)] = id;
      }
    } catch (err) {
      logger.error('[orderSyncRepository] syncOrdersBatch chunk error', {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        chunkOffset: offset,
        chunkSize: chunk.length,
        totalOrders: orders.length,
      });
      throw err;
    }
  }

  logger.info('[orderSyncRepository] syncOrdersBatch завершён', {
    total: orders.length,
    chunks: Math.ceil(orders.length / BULK_WRITE_CHUNK_SIZE),
    upserted: totals.upsertedCount,
    modified: totals.modifiedCount,
    matched: totals.matchedCount,
  });

  return totals;
};

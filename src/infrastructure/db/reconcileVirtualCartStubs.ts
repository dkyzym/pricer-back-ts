import type { AnyBulkWriteOperation } from 'mongoose';
import { logger } from '../../config/logger/index.js';
import { VIRTUAL_CART_ORDER_ID_PREFIX } from '../../constants/virtualCartOrder.js';
import { Order } from '../../models/Order.js';
import type { UnifiedOrderItem } from '../../services/orchestration/orders/orders.types.js';
import {
  normalizeArticleForReconciliation,
  normalizeOrderIdForReconciliation,
} from '../../utils/orders/reconciliationNormalize.js';

/** Разделитель составного ключа orderId+article — исключает ложные склейки при конкатенации строк. */
const RECONCILE_KEY_SEP = '\0';

type CartStubLean = {
  _id: unknown;
  id: string;
  orderId: string;
  article: string;
};

const stubCompositeKey = (orderId: string, article: string): string | null => {
  const nOrder = normalizeOrderIdForReconciliation(orderId);
  const nArt = normalizeArticleForReconciliation(article);
  if (!nOrder || !nArt) return null;
  return `${nOrder}${RECONCILE_KEY_SEP}${nArt}`;
};

/**
 * Склейка заглушек виртуальной корзины (`id` с префиксом cart_, status pending) с строками,
 * пришедшими от поставщика в одном пакете синка.
 *
 * Поток: два find (заглушки, существующие id) → в памяти очереди по ключу
 * (нормализованный orderId + '\0' + нормализованный article) → один bulkWrite (deleteOne/updateOne).
 *
 * Ограничения: ключ без brand — теоретические коллизии; пустой article/orderId у позиции API —
 * склейка пропускается (контролируемая деградация).
 */
export const reconcileVirtualCartStubsForSupplier = async (
  supplier: string,
  orders: UnifiedOrderItem[],
): Promise<void> => {
  if (orders.length === 0) {
    return;
  }

  const tStubs = Date.now();
  const stubs = await Order.find({
    supplier,
    status: 'pending',
    id: new RegExp(`^${VIRTUAL_CART_ORDER_ID_PREFIX}`),
  })
    .select({ _id: 1, id: 1, orderId: 1, article: 1 })
    .sort({ createdAt: 1 })
    .lean<CartStubLean[]>();

  logger.debug('[reconcileVirtualCartStubs] Загрузка заглушек', {
    supplier,
    durationMs: Date.now() - tStubs,
    stubsCount: stubs.length,
  });

  if (stubs.length === 0) {
    return;
  }

  const queueByKey = new Map<string, CartStubLean[]>();
  for (const stub of stubs) {
    const key = stubCompositeKey(stub.orderId, stub.article);
    if (key === null) continue;
    const list = queueByKey.get(key) ?? [];
    list.push(stub);
    queueByKey.set(key, list);
  }

  const uniqueIds = [...new Set(orders.map((o) => o.id))];
  const tExisting = Date.now();
  const existingRows = await Order.find({
    supplier,
    id: { $in: uniqueIds },
  })
    .select({ id: 1 })
    .lean<{ id: string }[]>();

  const existingIdSet = new Set(existingRows.map((r) => r.id));
  logger.debug('[reconcileVirtualCartStubs] Существующие id пакета', {
    supplier,
    durationMs: Date.now() - tExisting,
    count: existingIdSet.size,
  });

  const reconcileOps: AnyBulkWriteOperation[] = [];
  let deleteCount = 0;
  let updateCount = 0;

  for (const item of orders) {
    const key = stubCompositeKey(item.orderId, item.article);
    if (key === null) continue;

    const queue = queueByKey.get(key);
    if (!queue || queue.length === 0) continue;

    const stub = queue.shift()!;

    if (existingIdSet.has(item.id)) {
      reconcileOps.push({ deleteOne: { filter: { _id: stub._id } } });
      deleteCount += 1;
      continue;
    }

    reconcileOps.push({
      updateOne: {
        filter: { _id: stub._id },
        update: { $set: { id: item.id } },
      },
    });
    updateCount += 1;
    existingIdSet.add(item.id);
  }

  if (reconcileOps.length === 0) {
    return;
  }

  const tBulk = Date.now();
  await Order.bulkWrite(reconcileOps, { ordered: false });

  logger.info('[reconcileVirtualCartStubs] Склейка выполнена', {
    supplier,
    deleteCount,
    updateCount,
    bulkDurationMs: Date.now() - tBulk,
  });
};

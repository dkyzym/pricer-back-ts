import { Logger } from 'winston';
import { CartItem, ICartItemDocument } from '../../models/CartItem.js';
import { Order } from '../../models/Order.js';
import type { CheckoutResult } from '../orchestration/cart/cart.types.js';
import { checkoutHandlers } from '../orchestration/checkout/checkoutHandlers.js';

// =========================================================================
//  Типы отчёта
// =========================================================================

export interface CheckoutSupplierReport {
  supplier: string;
  cartItemIds: string[];
  success: boolean;
  externalOrderIds?: string[];
  ordersCreated?: number;
  error?: string;
}

export interface CheckoutReport {
  totalItems: number;
  successfulItems: number;
  failedItems: number;
  suppliers: CheckoutSupplierReport[];
}

// =========================================================================
//  Вспомогательные функции
// =========================================================================

/** Группирует документы по supplier. */
const groupBySupplier = (
  items: ICartItemDocument[],
): Map<string, ICartItemDocument[]> => {
  const groups = new Map<string, ICartItemDocument[]>();

  for (const item of items) {
    const list = groups.get(item.supplier) ?? [];
    list.push(item);
    groups.set(item.supplier, list);
  }

  return groups;
};

/**
 * Маппит CartItem + externalOrderIds → массив документов для Order.insertMany.
 *
 * Стратегия orderId / externalOrderId:
 *   - 1 externalOrderId → все строки: одинаковые orderId и externalOrderId.
 *   - N externalOrderIds === N позиций → сопоставление по индексу.
 *   - Несколько ID, но не 1:1 с позициями → orderId = первый ID (как раньше);
 *     externalOrderId не задаём (неоднозначно), полный список — в rawProviderData.externalOrderIds.
 *   - Нет ID от поставщика → orderId = cart-{timestamp}, без externalOrderId.
 */
const buildOrderDocs = (
  items: ICartItemDocument[],
  checkoutResult: CheckoutResult,
) => {
  const extIds = checkoutResult.externalOrderIds ?? [];
  const oneToOne = extIds.length === items.length;
  const ambiguousBulk =
    extIds.length > 1 && extIds.length !== items.length;
  const fallbackOrderId = extIds[0] ?? `cart-${Date.now()}`;

  return items.map((item, idx) => {
    const orderId = oneToOne
      ? extIds[idx]
      : extIds.length === 1
        ? extIds[0]
        : fallbackOrderId;

    const externalOrderId = ambiguousBulk
      ? undefined
      : oneToOne
        ? extIds[idx]
        : extIds[0];

    const price = item.currentPrice ?? item.initialPrice;

    const rawProviderData: Record<string, unknown> = {
      cartItemId: String(item._id),
    };
    if (ambiguousBulk) {
      rawProviderData.externalOrderIds = extIds;
    }

    return {
      id: `cart_${String(item._id)}`,
      orderId,
      ...(externalOrderId !== undefined ? { externalOrderId } : {}),
      supplier: item.supplier,
      brand: item.brand,
      article: item.article,
      name: item.name,
      quantity: item.quantity,
      price,
      totalPrice: +(price * item.quantity).toFixed(2),
      currency: 'RUB',
      status: 'pending' as const,
      statusRaw: 'Оформлен через виртуальную корзину',
      providerCreatedAt: new Date(),
      rawProviderData,
    };
  });
};

// =========================================================================
//  Основная функция
// =========================================================================

/**
 * Оформление заказов из виртуальной корзины.
 *
 * Поток данных:
 *   1. Загрузка CartItem-документов по ID (status: draft или approved).
 *   2. Группировка по supplier.
 *   3. Для каждой группы — получение CheckoutHandler из реестра checkoutHandlers.
 *      Если обработчик отсутствует, группа помечается как failed.
 *   4. Параллельный запуск всех обработчиков через Promise.allSettled.
 *   5. Для успешных: обновление статуса CartItem → 'ordered', создание Order-документов.
 *   6. Формирование сводного отчёта для фронтенда.
 */
export const checkoutCartItems = async (
  cartItemIds: string[],
  userLogger: Logger,
): Promise<CheckoutReport> => {
  const cartItems = await CartItem.find({
    _id: { $in: cartItemIds },
    status: { $in: ['draft', 'approved'] },
  });

  if (!cartItems.length) {
    userLogger.warn('[Checkout] Нет позиций со статусом draft/approved для оформления.');
    return { totalItems: 0, successfulItems: 0, failedItems: 0, suppliers: [] };
  }

  const groups = groupBySupplier(cartItems);
  const supplierReports: CheckoutSupplierReport[] = [];

  /** Замыкание: сохраняет ссылку на supplierReports для параллельных задач. */
  const tasks = Array.from(groups.entries()).map(
    async ([supplier, items]): Promise<void> => {
      const ids = items.map((i) => String(i._id));

      const checkoutHandler = checkoutHandlers[supplier];
      if (!checkoutHandler) {
        userLogger.warn(
          `[Checkout] Обработчик для «${supplier}» не найден, ${ids.length} позиций пропущено.`,
        );
        supplierReports.push({
          supplier,
          cartItemIds: ids,
          success: false,
          error: `Обработчик для поставщика «${supplier}» не зарегистрирован.`,
        });
        return;
      }

      let checkoutResult: CheckoutResult;
      try {
        checkoutResult = await checkoutHandler(items, userLogger);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Неизвестная ошибка обработчика.';
        userLogger.error(`[Checkout] ${supplier}: ${message}`);
        supplierReports.push({
          supplier,
          cartItemIds: ids,
          success: false,
          error: message,
        });
        return;
      }

      if (!checkoutResult.success) {
        supplierReports.push({
          supplier,
          cartItemIds: ids,
          success: false,
          error: checkoutResult.error ?? 'Обработчик вернул success: false.',
        });
        return;
      }

      // --- Успех: обновляем CartItem и создаём Order-документы ---

      await CartItem.updateMany(
        { _id: { $in: ids } },
        { $set: { status: 'ordered' } },
      );

      const orderDocs = buildOrderDocs(items, checkoutResult);
      let ordersCreated = 0;

      try {
        /**
         * ordered: false — без сортировки на стороне MongoDB; быстрее.
         * Дублирующиеся id (повторный checkout) будут проигнорированы.
         */
        const inserted = await Order.insertMany(orderDocs, { ordered: false });
        ordersCreated = inserted.length;
      } catch (err: unknown) {
        userLogger.error(
          `[Checkout] ${supplier}: ошибка при записи Order: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }

      userLogger.info(
        `[Checkout] ${supplier}: ${ids.length} позиций оформлено, ${ordersCreated} Order создано.`,
      );

      supplierReports.push({
        supplier,
        cartItemIds: ids,
        success: true,
        externalOrderIds: checkoutResult.externalOrderIds,
        ordersCreated,
      });
    },
  );

  await Promise.allSettled(tasks);

  const successfulItems = supplierReports
    .filter((r) => r.success)
    .reduce((sum, r) => sum + r.cartItemIds.length, 0);

  return {
    totalItems: cartItems.length,
    successfulItems,
    failedItems: cartItems.length - successfulItems,
    suppliers: supplierReports,
  };
};

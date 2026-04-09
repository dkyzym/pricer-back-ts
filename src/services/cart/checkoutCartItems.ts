import { Logger } from 'winston';
import { USER_ROLE } from '../../constants/userRoles.js';
import { toVirtualCartOrderId } from '../../constants/virtualCartOrder.js';
import { CartItem, ICartItemDocument } from '../../models/CartItem.js';
import { Order } from '../../models/Order.js';
import { NotFoundError, ValidationError } from '../../utils/errors.js';
import type { CartCheckoutOptions, CheckoutResult } from '../orchestration/cart/cart.types.js';
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

/** JWT-контекст для фильтрации корзины по владельцу (не-админ). */
export interface CheckoutCartUserCtx {
  username: string;
  role: string;
}

// =========================================================================
//  Вспомогательные функции
// =========================================================================

/** Непустая строка из process.env (trim; пустая строка считается отсутствием). */
const envNonEmpty = (name: string): string | undefined => {
  const v = process.env[name];
  if (v === undefined || v === null) return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
};

/**
 * Lean-документы CartItem совместимы с обработчиками: используются только поля,
 * без методов инстанса Mongoose.
 */
const asCartItemsForCheckout = (docs: unknown[]): ICartItemDocument[] =>
  docs as ICartItemDocument[];

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
      id: toVirtualCartOrderId(String(item._id)),
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
 *   1. Один запрос CartItem.find().lean() с фильтром по статусу и (для не-админа) username.
 *   2. Сверка числа документов с запрошенными id; при расхождении — NotFoundError.
 *   3. При наличии Patriot — проверка env до вызова обработчиков.
 *   4. Группировка по supplier, checkoutHandlers, updateMany + insertMany по успеху.
 */
export const checkoutCartItems = async (
  cartItemIds: string[],
  ctx: CheckoutCartUserCtx,
  userLogger: Logger,
  options?: CartCheckoutOptions,
): Promise<CheckoutReport> => {
  if (cartItemIds.length === 0) {
    userLogger.warn('[Checkout] Пустой список идентификаторов.');
    return { totalItems: 0, successfulItems: 0, failedItems: 0, suppliers: [] };
  }

  const filter: Record<string, unknown> = {
    _id: { $in: cartItemIds },
    status: { $in: ['draft', 'approved'] },
  };
  if (ctx.role !== USER_ROLE.ADMIN) {
    filter.username = ctx.username;
  }

  const rawDocs = await CartItem.find(filter).lean();
  const cartItems = asCartItemsForCheckout(rawDocs);

  if (cartItems.length !== cartItemIds.length) {
    throw new NotFoundError('Не все позиции найдены или недоступны');
  }

  if (cartItems.some((d) => d.supplier === 'patriot')) {
    const form = options?.patriotPaymentForm ?? 'non_cash';
    if (form === 'cash' && !envNonEmpty('PATRIOT_PAYMENT_METHOD_ID')) {
      throw new ValidationError(
        'Для оформления Patriot наличными задайте PATRIOT_PAYMENT_METHOD_ID в окружении сервера.',
      );
    }
    if (form === 'non_cash' && !envNonEmpty('PATRIOT_PAYMENT_METHOD_ID_BN')) {
      throw new ValidationError(
        'Для оформления Patriot безналом задайте PATRIOT_PAYMENT_METHOD_ID_BN в окружении сервера.',
      );
    }
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
        checkoutResult = await checkoutHandler(items, userLogger, options);
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

      /** Единая точка: что вернул адаптер и почему мог не заполниться externalOrderId. */
      userLogger.info(`[Checkout] Снимок ответа поставщика «${supplier}»`, {
        supplier,
        cartItemCount: ids.length,
        cartItemIds: ids,
        externalOrderIds: checkoutResult.externalOrderIds ?? [],
        hasExternalIds: (checkoutResult.externalOrderIds?.length ?? 0) > 0,
        note: checkoutResult.note,
        providerResponseSnapshot: checkoutResult.providerResponseSnapshot,
      });

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

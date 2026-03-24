import { Logger } from 'winston';
import { ICartItemDocument } from '../../../models/CartItem.js';
import { cartSupplierHandlers } from '../cart/cartHandlers.js';
import {
  CartHandlerResponse,
  CheckoutHandler,
  UnifiedCartRequest,
} from '../cart/cart.types.js';

const NOTE_SUCCESS =
  'Успешно добавлено в корзину поставщика. Требуется ручное оформление заказа на сайте.';

/**
 * Собирает UnifiedCartRequest из документа корзины: тот же контракт, что у add-to-cart
 * (полный объект результата поиска + актуальные quantity/brand/article с документа).
 */
const cartItemToUnifiedRequest = (cartItem: ICartItemDocument): UnifiedCartRequest => {
  const raw = cartItem.rawItemData;
  const base =
    raw !== null && typeof raw === 'object' && !Array.isArray(raw)
      ? { ...(raw as Record<string, unknown>) }
      : {};

  return {
    supplier: cartItem.supplier,
    quantity: cartItem.quantity,
    item: {
      ...base,
      brand: cartItem.brand,
      article: cartItem.article,
      number: (base.number as string | undefined) ?? cartItem.article,
    },
  };
};

/**
 * HTML-скраперы (mikano, autoImpulse, avtoPartner): физически добавляем позиции в корзину
 * на стороне поставщика через существующие cartSupplierHandlers, затем сообщаем о ручном шаге оформления.
 */
export const manualCheckoutHandler: CheckoutHandler = async (
  items: ICartItemDocument[],
  userLogger: Logger,
) => {
  const ids = items.map((i) => String(i._id));

  if (items.length === 0) {
    return { success: true, cartItemIds: ids, externalOrderIds: [] };
  }

  const bySupplier = new Map<string, ICartItemDocument[]>();
  for (const item of items) {
    const list = bySupplier.get(item.supplier) ?? [];
    list.push(item);
    bySupplier.set(item.supplier, list);
  }

  for (const [supplier, groupItems] of bySupplier) {
    const cartHandler = cartSupplierHandlers[supplier];
    if (!cartHandler) {
      userLogger.error('[ManualCheckout] Нет cartHandler для поставщика', { supplier });
      return {
        success: false,
        cartItemIds: ids,
        error: `Нет обработчика удалённой корзины для поставщика «${supplier}».`,
      };
    }

    for (const cartItem of groupItems) {
      const request = cartItemToUnifiedRequest(cartItem);
      let response: CartHandlerResponse;
      try {
        response = await cartHandler(request);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        userLogger.error('[ManualCheckout] Исключение при добавлении в корзину поставщика', {
          supplier,
          cartItemId: String(cartItem._id),
          error: message,
        });
        return { success: false, cartItemIds: ids, error: message };
      }

      if (!response.success) {
        userLogger.warn('[ManualCheckout] Поставщик отклонил добавление в корзину', {
          supplier,
          cartItemId: String(cartItem._id),
          message: response.message,
        });
        return {
          success: false,
          cartItemIds: ids,
          error:
            response.message || 'Не удалось добавить товар в корзину поставщика.',
        };
      }
    }
  }

  userLogger.info('[ManualCheckout] Позиции добавлены в корзину поставщика', {
    itemCount: items.length,
    cartItemIds: ids,
  });

  return {
    success: true,
    cartItemIds: ids,
    externalOrderIds: ['MANUAL-ORDER'],
    note: NOTE_SUCCESS,
  };
};

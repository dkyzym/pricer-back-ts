import { Logger } from 'winston';
import { ICartItemDocument } from '../../../models/CartItem.js';
import { clearAbcpCartHtml } from '../../platforms/abcp/parser/clearAbcpCartHtml.js';
import { submitAbcpOrderHtml } from '../../platforms/abcp/parser/submitAbcpOrderHtml.js';
import {
  CartHandlerResponse,
  CheckoutHandler,
  UnifiedCartRequest,
} from '../cart/cart.types.js';
import { cartSupplierHandlers } from '../cart/cartHandlers.js';

const NOTE_MANUAL =
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
 * Оркестратор чекаута для HTML-скраперов.
 * Для автоматизированных площадок (ABCP): очистка -> добавление -> автоматический submit.
 * Для остальных: добавление в корзину -> возврат MANUAL-ORDER.
 */
export const abcpHtmlCheckoutHandler: CheckoutHandler = async (
  items: ICartItemDocument[],
  userLogger: Logger,
  _options?,
) => {
  const ids = items.map((i) => String(i._id));

  if (items.length === 0) {
    return {
      success: true,
      cartItemIds: ids,
      externalOrderIds: [],
      providerResponseSnapshot: { adapter: 'abcpHtml', reason: 'empty_items' },
    };
  }

  const bySupplier = new Map<string, ICartItemDocument[]>();
  for (const item of items) {
    const list = bySupplier.get(item.supplier) ?? [];
    list.push(item);
    bySupplier.set(item.supplier, list);
  }

  const externalOrderIds: string[] = [];
  let needsManualNote = false;

  for (const [supplier, groupItems] of bySupplier) {
    const cartHandler = cartSupplierHandlers[supplier];
    if (!cartHandler) {
      userLogger.error('[AbcpHtmlCheckout] Нет cartHandler для поставщика', { supplier });
      return {
        success: false,
        cartItemIds: ids,
        error: `Нет обработчика удалённой корзины для поставщика «${supplier}».`,
      };
    }

    // Флаг для определения площадок с полным циклом авто-чекаута
    const isAutoCheckout = supplier === 'mikano' || supplier === 'autoImpulse';

    if (isAutoCheckout) {
      const clearRes = await clearAbcpCartHtml(supplier);
      if (!clearRes.success) {
        userLogger.error('[AbcpHtmlCheckout] Не удалось очистить корзину ABCP перед добавлением', {
          supplier,
          error: clearRes.error,
        });
        return { success: false, cartItemIds: ids, error: clearRes.error };
      }
      if (clearRes.removedCount > 0) {
        userLogger.info('[AbcpHtmlCheckout] Очищена корзина поставщика ABCP перед добавлением позиций', {
          supplier,
          removedCount: clearRes.removedCount,
        });
      }
    }

    for (const cartItem of groupItems) {
      const request = cartItemToUnifiedRequest(cartItem);
      let response: CartHandlerResponse;
      try {
        response = await cartHandler(request);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        userLogger.error('[AbcpHtmlCheckout] Исключение при добавлении в корзину поставщика', {
          supplier,
          cartItemId: String(cartItem._id),
          error: message,
        });
        return { success: false, cartItemIds: ids, error: message };
      }

      if (!response.success) {
        userLogger.warn('[AbcpHtmlCheckout] Поставщик отклонил добавление в корзину', {
          supplier,
          cartItemId: String(cartItem._id),
          message: response.message,
        });
        return {
          success: false,
          cartItemIds: ids,
          error: response.message || 'Не удалось добавить товар в корзину поставщика.',
        };
      }
    }

    if (isAutoCheckout) {
      const submitRes = await submitAbcpOrderHtml(supplier, groupItems);
      if (!submitRes.success) {
        userLogger.error('[AbcpHtmlCheckout] Ошибка автоматического оформления ABCP', {
          supplier,
          error: submitRes.error,
        });
        return { success: false, cartItemIds: ids, error: submitRes.error };
      }
      externalOrderIds.push(submitRes.externalOrderId!);
    } else {
      // Фолбэк для площадок, маршрутизируемых сюда, но требующих ручного клика на сайте
      externalOrderIds.push('MANUAL-ORDER');
      needsManualNote = true;
    }
  }

  userLogger.info('[AbcpHtmlCheckout] Позиции успешно обработаны', {
    itemCount: items.length,
    cartItemIds: ids,
    externalOrderIds,
  });

  return {
    success: true,
    cartItemIds: ids,
    externalOrderIds,
    ...(needsManualNote ? { note: NOTE_MANUAL } : {}),
    providerResponseSnapshot: {
      adapter: 'abcpHtml',
      externalOrderIds,
      needsManualNote,
      supplierGroups: [...bySupplier.keys()],
    },
  };
};
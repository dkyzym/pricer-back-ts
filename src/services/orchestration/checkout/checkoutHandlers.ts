import { Logger } from 'winston';
import { ICartItemDocument } from '../../../models/CartItem.js';
import { CheckoutHandler, CheckoutResult } from '../cart/cart.types.js';

// ─────────────────────────────────────────────────────────────────────────────
//  Вспомогательная фабрика «заглушки»
// ─────────────────────────────────────────────────────────────────────────────

/** Паттерн «Factory» — создаёт именованную заглушку, логирующую вызов. */
const notImplemented =
  (supplierKey: string): CheckoutHandler =>
  async (items: ICartItemDocument[], userLogger: Logger): Promise<CheckoutResult> => {
    userLogger.warn(`[CheckoutHandler] ${supplierKey}: адаптер не реализован`, {
      itemCount: items.length,
    });
    return {
      success: false,
      cartItemIds: items.map((i) => String(i._id)),
      error: 'Not implemented',
    };
  };

// ─────────────────────────────────────────────────────────────────────────────
//  Armtek
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Алгоритм реализации (Armtek):
 *   1. Из `rawItemData` собрать payload для endpoint создания заказа
 *      (поля ARTID, KEYZAK, PARNR, RVALUE, PRICE).
 *   2. Вызвать метод API Armtek «create_order» единым запросом.
 *   3. Извлечь из ответа идентификаторы заказов и вернуть в `externalOrderIds`.
 */
const armtekHandler: CheckoutHandler = notImplemented('armtek');

// ─────────────────────────────────────────────────────────────────────────────
//  TurboCars
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Алгоритм реализации (TurboCars):
 *   1. Из `rawItemData` собрать массив позиций payload для API TurboCars.
 *   2. Отправить единый запрос на checkout-endpoint TurboCars.
 *   3. Разобрать ответ и вернуть номера заказов в `externalOrderIds`.
 */
const turboCarsHandler: CheckoutHandler = notImplemented('turboCars');

// ─────────────────────────────────────────────────────────────────────────────
//  ABCP  (покрывает: ug, patriot, npn и аналогичные ABCP-площадки)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Алгоритм реализации (ABCP):
 *   1. Очистить корзину поставщика через DELETE /basket.
 *   2. Последовательно добавить каждую позицию через POST /basket,
 *      используя свежие токены из `rawItemData` (number, brand, supplierCode, itemKey).
 *   3. Инициировать оформление заказа через POST /orders.
 *   4. Извлечь и вернуть идентификаторы созданных заказов.
 */
const abcpHandler: CheckoutHandler = notImplemented('abcp');

// ─────────────────────────────────────────────────────────────────────────────
//  Profit
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Алгоритм реализации (Profit):
 *   1. Очистить корзину поставщика (DELETE корзины Profit).
 *   2. Последовательно добавить каждую позицию через POST /cart,
 *      используя свежие токены из `rawItemData` (product_code, warehouse_id, donkey).
 *   3. Вызвать checkout-endpoint Profit для подтверждения заказа.
 *   4. Разобрать ответ и вернуть order_id в `externalOrderIds`.
 */
const profitHandler: CheckoutHandler = notImplemented('profit');

// ─────────────────────────────────────────────────────────────────────────────
//  Autosputnik
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Алгоритм реализации (Autosputnik):
 *   1. Очистить корзину поставщика (удалить все позиции через API Autosputnik).
 *   2. Последовательно добавить каждую позицию через POST /addtocart,
 *      используя свежие токены из `rawItemData`
 *      (brand — id бренда, articul, id_shop_prices, amount, price).
 *   3. Инициировать оформление заказа через POST /makeorder.
 *   4. Извлечь и вернуть customers_basket_id каждой строки в `externalOrderIds`.
 */
const autosputnikHandler: CheckoutHandler = notImplemented('autosputnik');

// ─────────────────────────────────────────────────────────────────────────────
//  Реестр обработчиков checkout (Паттерн «Registry / Strategy»)
//  Ключи соответствуют значениям поля `supplier` в ICartItemDocument.
// ─────────────────────────────────────────────────────────────────────────────

export const checkoutHandlers: Record<string, CheckoutHandler> = {
  armtek: armtekHandler,
  turboCars: turboCarsHandler,
  profit: profitHandler,
  autosputnik: autosputnikHandler,
  autosputnik_bn: autosputnikHandler,

  /** ABCP-площадки — один адаптер, разные аккаунты/витрины. */
  ug: abcpHandler,
  ug_f: abcpHandler,
  ug_bn: abcpHandler,
  patriot: abcpHandler,
  npn: abcpHandler,
  avtodinamika: abcpHandler,
  mikano: abcpHandler,
  autoImpulse: abcpHandler,
  avtoPartner: abcpHandler,
};

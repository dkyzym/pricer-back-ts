/**
 * Синтетический префикс `Order.id` для связи документа заказа с позицией виртуальной корзины
 * при оформлении из корзины (см. checkoutCartItems). Единая точка правды для префикса и парсинга.
 */
export const VIRTUAL_CART_ORDER_ID_PREFIX = 'cart_' as const;

export const toVirtualCartOrderId = (cartItemId: string): string =>
  `${VIRTUAL_CART_ORDER_ID_PREFIX}${cartItemId}`;

/** Извлекает id CartItem из `Order.id`; если префикса нет, возвращает строку как есть (обратная совместимость). */
export const cartItemIdFromVirtualOrderId = (orderId: string): string =>
  orderId.startsWith(VIRTUAL_CART_ORDER_ID_PREFIX)
    ? orderId.slice(VIRTUAL_CART_ORDER_ID_PREFIX.length)
    : orderId;

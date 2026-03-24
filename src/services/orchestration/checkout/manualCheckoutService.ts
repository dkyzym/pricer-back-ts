import { CheckoutHandler } from '../cart/cart.types.js';

/**
 * Заглушка для поставщиков без стабильного API оформления заказов (HTML-скраперы).
 * Не выполняет HTTP-запросов — только формирует результат,
 * сигнализирующий о необходимости ручной обработки на сайте поставщика.
 */
export const manualCheckoutHandler: CheckoutHandler = async (items, userLogger) => {
  const ids = items.map((i) => String(i._id));

  userLogger.info('[ManualCheckout] Позиции требуют ручного оформления на сайте поставщика', {
    itemCount: items.length,
    cartItemIds: ids,
  });

  return {
    success: true,
    cartItemIds: ids,
    externalOrderIds: ['MANUAL-ORDER'],
    note: 'Requires manual processing on the vendor website',
  };
};

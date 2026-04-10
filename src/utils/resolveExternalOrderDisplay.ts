/** Минимальные поля Order для отображения внешнего номера в UI списка корзины. */
export type OrderExternalDisplaySource = {
  externalOrderId?: string;
  /** Номер строки заказа; фолбэк для старых документов, где external не сохранили, но orderId уже не заглушка cart- */
  orderId?: string;
  rawProviderData?: { externalOrderIds?: unknown };
};

/** Заглушка виртуальной корзины без номера поставщика — не показываем как «внешний» номер. */
const isSyntheticCartPlaceholderOrderId = (value: string): boolean =>
  /^cart-\d+$/u.test(value.trim());

/**
 * Строка для UI: внешний номер заказа у поставщика или перечисление из raw при неоднозначном bulk.
 * Логика подготовки представления для фронта, не относится к слою доступа к БД.
 *
 * Фолбэк на orderId: закрывает исторические записи и кейсы, где номер поставщика попал только в orderId.
 */
export const resolveExternalOrderDisplay = (
  order: OrderExternalDisplaySource,
): string | null => {
  if (order.externalOrderId) return order.externalOrderId;
  const ids = order.rawProviderData?.externalOrderIds;
  if (Array.isArray(ids) && ids.length > 0) {
    return ids.map(String).join(', ');
  }
  const oid = order.orderId?.trim();
  if (oid && !isSyntheticCartPlaceholderOrderId(oid)) {
    return oid;
  }
  return null;
};

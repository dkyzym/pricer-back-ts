/** Минимальные поля Order для отображения внешнего номера в UI списка корзины. */
export type OrderExternalDisplaySource = {
  externalOrderId?: string;
  rawProviderData?: { externalOrderIds?: unknown };
};

/**
 * Строка для UI: внешний номер заказа у поставщика или перечисление из raw при неоднозначном bulk.
 * Логика подготовки представления для фронта, не относится к слою доступа к БД.
 */
export const resolveExternalOrderDisplay = (
  order: OrderExternalDisplaySource,
): string | null => {
  if (order.externalOrderId) return order.externalOrderId;
  const ids = order.rawProviderData?.externalOrderIds;
  if (Array.isArray(ids) && ids.length > 0) {
    return ids.map(String).join(', ');
  }
  return null;
};

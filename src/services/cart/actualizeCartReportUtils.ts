import type { ICartItemDocument } from '../../models/CartItem.js';

/** Направление изменения цены относительно базы (последняя актуальная или начальная). */
export type ActualizePriceDirection = 'up' | 'down' | 'unchanged' | null;

/** Остаток относительно запрошенного количества. */
export type ActualizeStockStatus = 'sufficient' | 'insufficient' | 'unknown';

/**
 * База сравнения цены до записи новой: `currentPrice` из БД, иначе `initialPrice`.
 * Если оба не заданы как конечные числа — null (тогда `priceDirection` в отчёте тоже null).
 */
export const resolvePriceComparisonBaseline = (
  cartItem: ICartItemDocument,
): number | null => {
  const cur = cartItem.currentPrice;
  if (cur != null && typeof cur === 'number' && Number.isFinite(cur)) {
    return cur;
  }
  const init = cartItem.initialPrice;
  if (typeof init === 'number' && Number.isFinite(init)) {
    return init;
  }
  return null;
};

export const computeActualizePriceDirection = (
  baseline: number | null,
  newPrice: number | null,
): ActualizePriceDirection => {
  if (
    baseline === null ||
    newPrice === null ||
    typeof newPrice !== 'number' ||
    !Number.isFinite(newPrice)
  ) {
    return null;
  }
  const diff = newPrice - baseline;
  if (diff > 0) return 'up';
  if (diff < 0) return 'down';
  return 'unchanged';
};

/**
 * unknown — парсер не извлёк число; insufficient — число строго меньше запрошенного;
 * sufficient — число >= запрошенного.
 */
export const computeActualizeStockStatus = (
  availNum: number | null,
  requestedQuantity: number,
): ActualizeStockStatus => {
  if (availNum === null) return 'unknown';
  if (availNum < requestedQuantity) return 'insufficient';
  return 'sufficient';
};

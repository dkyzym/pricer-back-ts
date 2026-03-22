import { AbcpArticleSearchResult } from '../../platforms/abcp/abcpPlatform.types.js';

/**
 * Коды `meta.abcpWh` от ABCP, которые у НПН означают отгрузку со своего склада.
 */
export const NPN_OWN_WAREHOUSE_ABCP_WH_CODES: readonly string[] = [];

/**
 * `supplierCode` позиций со своего склада (из дампов API), если нужно явное дополнение к эвристике ниже.
 */
export const NPN_OWN_SUPPLIER_CODES: readonly number[] = [];

const NPN_OWN_STOCK_MAX_DELIVERY_HOURS = 24;

const isBlankDeadlineReplace = (value: unknown): boolean =>
  value == null || (typeof value === 'string' && value.trim() === '');

/** Часы периода для подписи склада: только `number` из API, иначе дефолт. */
const periodHoursForWarehouse = (item: AbcpArticleSearchResult): number =>
  typeof item.deliveryPeriod === 'number' && Number.isFinite(item.deliveryPeriod)
    ? item.deliveryPeriod
    : 24;

const maxHoursForWarehouse = (
  item: AbcpArticleSearchResult,
  periodHours: number
): number => {
  const m = item.deliveryPeriodMax;
  if (m === '' || m == null) return periodHours;
  if (typeof m === 'number' && Number.isFinite(m)) return m;
  if (typeof m === 'string' && m.trim() !== '') {
    const parsed = parseInt(m.trim(), 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return periodHours;
};

const withinOwnStockLeadTime = (item: AbcpArticleSearchResult): boolean => {
  const hours = periodHoursForWarehouse(item);
  const maxHours = maxHoursForWarehouse(item, hours);
  return (
    hours <= NPN_OWN_STOCK_MAX_DELIVERY_HOURS &&
    maxHours <= NPN_OWN_STOCK_MAX_DELIVERY_HOURS
  );
};

/**
 * По дампам НПН: свой склад при пустом `deadlineReplace` — `deliveryPeriod === 0` и max не задан / 0.
 */
const isZeroLeadBlankMax = (item: AbcpArticleSearchResult): boolean => {
  if (
    typeof item.deliveryPeriod !== 'number' ||
    !Number.isFinite(item.deliveryPeriod) ||
    item.deliveryPeriod !== 0
  ) {
    return false;
  }
  const maxRaw = item.deliveryPeriodMax;
  if (maxRaw === '' || maxRaw == null) return true;
  if (typeof maxRaw === 'number' && maxRaw === 0) return true;
  if (typeof maxRaw === 'string' && maxRaw.trim() !== '') {
    const n = parseInt(maxRaw.trim(), 10);
    return Number.isFinite(n) && n === 0;
  }
  return false;
};

const indicatesStockOnOwnShelf = (rule: string): boolean => {
  const t = rule.toLowerCase();
  return t.includes('на складе');
};

const isOwnByAbcpWh = (item: AbcpArticleSearchResult): boolean => {
  const wh = item.meta?.abcpWh?.trim();
  if (!wh) return false;
  return NPN_OWN_WAREHOUSE_ABCP_WH_CODES.includes(wh);
};

const isOwnBySupplierCode = (item: AbcpArticleSearchResult): boolean =>
  NPN_OWN_SUPPLIER_CODES.length > 0 &&
  NPN_OWN_SUPPLIER_CODES.includes(item.supplierCode);

/**
 * Подпись склада: без `supplierColor` — только сроки, коды складов/поставщика из списков и текст правила.
 */
export const getNpnWarehouseLabel = (item: AbcpArticleSearchResult): string => {
  if (isOwnByAbcpWh(item)) return 'СВОЙ СКЛАД';
  if (isOwnBySupplierCode(item)) return 'СВОЙ СКЛАД';

  const ruleRaw = item.deadlineReplace;
  if (isBlankDeadlineReplace(ruleRaw)) {
    if (isZeroLeadBlankMax(item)) return 'СВОЙ СКЛАД';
    return withinOwnStockLeadTime(item) ? 'СВОЙ СКЛАД' : 'ЧУЖОЙ СКЛАД';
  }

  const rule = String(ruleRaw).trim();
  if (indicatesStockOnOwnShelf(rule) && withinOwnStockLeadTime(item)) {
    return 'СВОЙ СКЛАД';
  }
  return `ЧУЖОЙ СКЛАД ${rule}`;
};

import { OrderStatus, UnifiedOrderItem } from '../../orchestration/orders/orders.types.js';
import type { ArmtekOrderReportRow } from './armtekOrderSync.types.js';

/**
 * Достаёт значение по одному из имён поля без учёта регистра.
 * Armtek отдаёт ключи непоследовательно (ORDER / order / VBELN / vbeln).
 */
const pickStr = (row: Record<string, unknown>, ...candidates: string[]): string => {
  const lowerToActual = new Map<string, string>();
  for (const k of Object.keys(row)) {
    lowerToActual.set(k.toLowerCase(), k);
  }
  for (const c of candidates) {
    const act = lowerToActual.get(c.toLowerCase());
    if (act === undefined) continue;
    const v = row[act];
    if (v == null) continue;
    const s = String(v).trim();
    if (s !== '') return s;
  }
  return '';
};

const parseArmtekNumber = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const normalized = value.trim().replace(/\s+/g, '').replace(',', '.');
    const parsed = Number.parseFloat(normalized);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

/** Дата Armtek YYYYMMDD или YYYYMMDDHHMMSS → ISO UTC. */
const parseArmtekDateToIso = (raw: string | undefined): string | undefined => {
  if (!raw || typeof raw !== 'string') return undefined;
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 8) return undefined;
  const y = Number(digits.slice(0, 4));
  const mo = Number(digits.slice(4, 6)) - 1;
  const d = Number(digits.slice(6, 8));
  const h = digits.length >= 14 ? Number(digits.slice(8, 10)) : 0;
  const mi = digits.length >= 14 ? Number(digits.slice(10, 12)) : 0;
  const s = digits.length >= 14 ? Number(digits.slice(12, 14)) : 0;
  const dt = new Date(Date.UTC(y, mo, d, h, mi, s));
  return Number.isNaN(dt.getTime()) ? undefined : dt.toISOString();
};

/**
 * Гибкий маппинг статусов по подстрокам (case-insensitive).
 * Приоритет: статус позиции > статус заголовка заказа.
 */
const mapArmtekStatus = (rawStatus: string | undefined): OrderStatus => {
  const s = (rawStatus ?? '').toLowerCase();

  if (s.includes('отклонен') || s.includes('отказ') || s.includes('нет в наличии') || s.includes('снят'))
    return 'refused';

  if (s.includes('готов') || s.includes('ready') || s.includes('пришло'))
    return 'ready';

  if (s.includes('в пути') || s.includes('отгружен') || s.includes('shipped') || s.includes('wayquan'))
    return 'shipping';

  if (s.includes('в работе') || s.includes('confirmed') || s.includes('waiting') || s.includes('planned'))
    return 'work';

  if (s.includes('закрыт') || s.includes('выдан') || s.includes('delivered'))
    return 'finished';

  if (s.includes('создан') || s.includes('processing'))
    return 'pending';

  return 'unknown';
};

/**
 * Маппинг строк отчёта getOrderReportByDate в UnifiedOrderItem[].
 *
 * Реконсиляция: `orderId` = VBELN (номер заказа Armtek), `article` = PIN (артикул).
 * Статус: если в строке есть отдельный статус позиции (STATUS / LINE_STATUS) —
 * он приоритетнее статуса заголовка заказа (ORDER_STATUS).
 */
export const mapArmtekOrdersToUnified = (
  rows: ArmtekOrderReportRow[],
  supplierAlias: string,
): UnifiedOrderItem[] =>
  rows.map((row, idx) => {
    const orderId = pickStr(row, 'vbeln', 'VBELN', 'order', 'ORDER');
    const pin = pickStr(row, 'pin', 'PIN', 'matnr', 'MATNR');
    const posnr = pickStr(row, 'posnr', 'POSNR');
    const brand = pickStr(row, 'brand', 'BRAND', 'mfrname', 'MFRNAME');
    const name = pickStr(row, 'name', 'NAME', 'artname', 'ARTNAME', 'txt', 'TXT');

    const qty = parseArmtekNumber(
      (row.menge ?? row.MENGE ?? row.kwmeng ?? row.KWMENG ?? row.zzKwmeng ?? row.ZZ_KWMENG) as unknown,
    );
    const price = parseArmtekNumber((row.price ?? row.PRICE) as unknown);
    const summa = parseArmtekNumber((row.summa ?? row.SUMMA) as unknown);

    /* Статус позиции приоритетнее статуса заголовка заказа */
    const itemStatusRaw = pickStr(row, 'status', 'STATUS', 'line_status', 'LINE_STATUS', 'item_status', 'ITEM_STATUS');
    const orderStatusRaw = pickStr(row, 'orderStatus', 'ORDER_STATUS', 'orderstatus', 'header_status');
    const effectiveStatusRaw = itemStatusRaw || orderStatusRaw;
    const status = mapArmtekStatus(effectiveStatusRaw);
    const statusRaw = [itemStatusRaw, orderStatusRaw].filter(Boolean).join(' | ') || 'unknown';

    const orderDateRaw = pickStr(row, 'orderDate', 'ORDER_DATE', 'orderdate', 'erdat', 'ERDAT');
    const createdAt = parseArmtekDateToIso(orderDateRaw) ?? new Date().toISOString();

    const currency = pickStr(row, 'currency', 'CURRENCY') || 'RUB';

    const totalPrice = summa > 0 ? +summa.toFixed(2) : +(price * (qty || 1)).toFixed(2);

    const idParts = [orderId || `row${idx}`, posnr || String(idx), pin || 'na'].join('_');
    const id = idParts.replace(/\s+/g, '');

    const dlvRaw = pickStr(row, 'dlvrd', 'DLVRD', 'wrntd', 'WRNTD', 'delivery_date', 'DELIVERY_DATE');
    const deliveryDate = parseArmtekDateToIso(dlvRaw);

    const abgru = pickStr(row, 'abgruTxt', 'ABGRU_TXT', 'reject_reason', 'REJECT_REASON');

    return {
      id,
      orderId,
      supplier: supplierAlias,
      brand,
      article: pin,
      name: name || pin || '—',
      quantity: qty > 0 ? qty : 1,
      price: price > 0 ? price : totalPrice / Math.max(qty, 1),
      totalPrice,
      currency,
      status,
      statusRaw,
      createdAt,
      ...(deliveryDate ? { deliveryDate } : {}),
      ...(abgru ? { comment: abgru } : {}),
    } satisfies UnifiedOrderItem;
  });

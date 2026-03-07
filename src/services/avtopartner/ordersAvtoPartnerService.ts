import * as cheerio from 'cheerio';
import { Logger } from 'winston';
import { brandGroupsMap } from '@constants/brandGroupsMap.js';
import { Order } from '../../models/Order.js';
import type { UnifiedOrderItem } from '../orders/orders.types.js';
import { getAllBrandsListSync } from '../brands/allBrandsCache.js';
import { clientAvtoPartner } from './client.js';
import { ensureAvtoPartnerLoggedIn } from './loginAvtoPartner.js';

const SUPPLIER_KEY = 'avtoPartner';
const MAX_HISTORY_PAGES = 10;
const BASE_DELAY_MS = 300;
const MAX_JITTER_MS = 400;
const MIN_NON_PREFIX_BRAND_LEN = 3;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function cleanText(text: string | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

interface BrandIndex {
  lookup: Map<string, string>;
  maxWords: number;
}

let cachedBrandIndex: BrandIndex | null = null;

function isViableBrand(value: string): boolean {
  if (value.length < 2) return false;
  if (/^\d+$/.test(value)) return false;
  return /[a-zA-Zа-яА-ЯёЁ]/.test(value);
}

function buildBrandIndex(): BrandIndex {
  const lookup = new Map<string, string>();
  let maxWords = 1;

  const add = (brand: string): void => {
    const trimmed = brand.trim();
    if (!isViableBrand(trimmed)) return;
    const key = trimmed.toLowerCase();
    if (lookup.has(key)) return;
    lookup.set(key, trimmed);
    const wc = trimmed.split(/\s+/).length;
    if (wc > maxWords) maxWords = wc;
  };

  for (const brand of getAllBrandsListSync()) add(brand);
  for (const group of brandGroupsMap) {
    for (const alias of group) add(alias);
  }

  return { lookup, maxWords: Math.min(maxWords, 6) };
}

function getBrandIndex(): BrandIndex {
  cachedBrandIndex ??= buildBrandIndex();
  return cachedBrandIndex;
}

function extractBrandFromName(name: string): string {
  const cleaned = cleanText(name);
  if (!cleaned) return '';

  const { lookup, maxWords } = getBrandIndex();
  const words = cleaned.split(/\s+/);
  const wc = words.length;

  for (let len = Math.min(wc, maxWords); len > 0; len--) {
    const found = lookup.get(words.slice(0, len).join(' ').toLowerCase());
    if (found) return found;
  }

  for (let start = 1; start < wc; start++) {
    for (let len = Math.min(wc - start, maxWords); len > 0; len--) {
      const candidate = words.slice(start, start + len).join(' ');
      if (candidate.length < MIN_NON_PREFIX_BRAND_LEN) continue;
      const found = lookup.get(candidate.toLowerCase());
      if (found) return found;
    }
  }

  return words[0] ?? '';
}

function parsePrice(raw: string | undefined): number {
  if (!raw) return 0;
  const num = parseFloat(
    raw
      .replace(/[\s\u00a0₽]/g, '')
      .replace(',', '.')
      .replace(/[^\d.]/g, '')
  );
  return Number.isFinite(num) ? num : 0;
}

function parseDateDdMmYyyy(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const m = raw.trim().match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (!m) return undefined;
  const [, d, month, year] = m;
  const date = new Date(
    parseInt(year, 10),
    parseInt(month, 10) - 1,
    parseInt(d, 10)
  );
  return date.toISOString();
}

export interface AvtoPartnerOrderSummary {
  orderId: string;
  userOrderUrl: string;
  createdAt: string;
  total: number;
  statusRaw: string;
}

export function parseHistoryPageHtml(html: string): AvtoPartnerOrderSummary[] {
  const $ = cheerio.load(html);
  const rows = $(
    '.account-orders__table table tbody tr, .view-content table tbody tr'
  );
  if (rows.length === 0) return [];

  const result: AvtoPartnerOrderSummary[] = [];
  rows.each((_, el) => {
    const $row = $(el);
    const $cells = $row.find('td');
    if ($cells.length < 4) return;

    const $orderLink = $row.find(
      '.views-field-order-number a[href*="/orders/"]'
    );
    const orderId = cleanText($orderLink.text());
    const href = $orderLink.attr('href') ?? '';
    const userOrderUrl = href;

    const dateText = cleanText($row.find('.views-field-placed').text());
    const totalText = cleanText(
      $row.find('.views-field-commerce-order-total').text()
    );
    const statusRaw = cleanText($row.find('.views-field-status').text());

    if (!orderId) return;

    const createdAt = parseDateDdMmYyyy(dateText);
    if (!createdAt) return;

    result.push({
      orderId,
      userOrderUrl,
      createdAt,
      total: parsePrice(totalText),
      statusRaw: statusRaw || 'Принят в работу',
    });
  });
  return result;
}

export function parseOrderDetailsHtml(
  html: string,
  summary: AvtoPartnerOrderSummary
): UnifiedOrderItem[] {
  const $ = cheerio.load(html);
  const items: UnifiedOrderItem[] = [];

  let orderCreatedAt = summary.createdAt;
  let deliveryDate: string | undefined;

  $('.orderinfo__data-item').each((_, el) => {
    const $el = $(el);
    const name = cleanText($el.find('.orderinfo__data-name').text());
    const value = cleanText($el.find('.orderinfo__data-value').text());
    if (name.includes('Дата оформления'))
      orderCreatedAt = parseDateDdMmYyyy(value) ?? orderCreatedAt;
    if (name.includes('Дата доставки') && value)
      deliveryDate = parseDateDdMmYyyy(value);
  });

  const products = $('li.orderinfo__product[data-lineid]');
  products.each((index, el) => {
    const $li = $(el);
    const lineId = $li.attr('data-lineid') ?? String(index);

    const skuText = cleanText($li.find('.cart-product__sku').text());
    const article =
      skuText.replace(/^Артикул:\s*/i, '').trim() || `line-${lineId}`;
    const name = cleanText($li.find('.cart-product__title').text());

    const qtyText = cleanText(
      $li.find('.cart-product__orderinfo-quantity').text()
    );
    const quantity = parseInt(qtyText.replace(/\D/g, ''), 10) || 1;

    const priceEl = $li.find('.cart-product__price .price__current');
    const priceText = priceEl.clone().children().remove().end().text();
    const lineTotal = parsePrice(priceText);
    const price =
      quantity > 0 ? Math.round((lineTotal / quantity) * 100) / 100 : 0;

    const id = `${SUPPLIER_KEY}_${summary.orderId}_${article}_${lineId}`;

    items.push({
      id,
      orderId: summary.orderId,
      supplier: SUPPLIER_KEY,
      brand: extractBrandFromName(name),
      article,
      name,
      quantity,
      price,
      totalPrice: Number(lineTotal.toFixed(2)),
      currency: 'RUB',
      status: 'work',
      statusRaw: summary.statusRaw,
      createdAt: orderCreatedAt,
      deliveryDate,
    });
  });

  return items;
}

function getNextPagePath(html: string, currentPath: string): string | null {
  const $ = cheerio.load(html);
  const nextLink = $('a.paginations__next[href]:not(.is-disabled)').attr(
    'href'
  );
  if (!nextLink) return null;
  let path: string;
  if (nextLink.startsWith('http')) {
    const u = new URL(nextLink);
    path = u.pathname + u.search;
  } else {
    path = nextLink;
  }
  const pathNorm = path.replace(/\?$/, '');
  const currentNorm = currentPath.replace(/\?$/, '');
  return pathNorm !== currentNorm ? pathNorm : null;
}

export async function fetchAvtoPartnerOrders(
  logger: Logger,
  targetSyncDate: Date
): Promise<UnifiedOrderItem[]> {
  const ordersPath = process.env.AVTOPARTNER_ORDERS_PATH;
  if (!ordersPath)
    throw new Error('[avtoPartner] AVTOPARTNER_ORDERS_PATH не задан в .env');

  await ensureAvtoPartnerLoggedIn();

  const lastOrder = await Order.findOne({ supplier: SUPPLIER_KEY })
    .sort({ providerCreatedAt: -1 })
    .select('orderId providerCreatedAt')
    .lean();
  const lastKnownOrderId = lastOrder?.orderId ?? null;

  const summariesToFetch: AvtoPartnerOrderSummary[] = [];
  let currentPath = ordersPath;
  let pageCount = 0;

  while (pageCount < MAX_HISTORY_PAGES) {
    let stopReason: 'last_seen' | 'date_limit' | null = null;
    pageCount++;
    const url = currentPath;
    const response = await clientAvtoPartner.get(url);
    const html = response.data as string;
    const rows = parseHistoryPageHtml(html);

    if (rows.length === 0) break;

    for (const row of rows) {
      if (lastKnownOrderId && row.orderId === lastKnownOrderId) {
        stopReason = 'last_seen';
        break;
      }
      const rowDate = new Date(row.createdAt);
      if (!lastKnownOrderId && rowDate < targetSyncDate) {
        stopReason = 'date_limit';
        break;
      }
      summariesToFetch.push(row);
    }

    if (stopReason != null) break;

    const nextPath = getNextPagePath(html, currentPath);
    if (!nextPath || nextPath === currentPath) break;
    currentPath = nextPath;

    // Базовая задержка 300мс + случайный джиттер до 400мс
    await delay(BASE_DELAY_MS + Math.floor(Math.random() * MAX_JITTER_MS));
  }

  if (pageCount >= MAX_HISTORY_PAGES) {
    logger.warn(
      `[${SUPPLIER_KEY}] Достигнут лимит страниц истории (${MAX_HISTORY_PAGES})`
    );
  }

  const allItems: UnifiedOrderItem[] = [];
  for (const summary of summariesToFetch) {
    const orderPath = summary.userOrderUrl.startsWith('http')
      ? new URL(summary.userOrderUrl).pathname
      : summary.userOrderUrl;
    try {
      const res = await clientAvtoPartner.get(orderPath);
      const items = parseOrderDetailsHtml(res.data as string, summary);
      allItems.push(...items);
    } catch (err) {
      logger.error(
        `[${SUPPLIER_KEY}] Ошибка загрузки заказа ${summary.orderId}`,
        { error: err }
      );
    }

    // Базовая задержка 300мс + случайный джиттер до 400мс
    await delay(BASE_DELAY_MS + Math.floor(Math.random() * MAX_JITTER_MS));
  }

  return allItems;
}

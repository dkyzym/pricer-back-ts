import * as cheerio from 'cheerio';

import { logger } from '../../../../../config/logger/index.js';
import { abcpHeaders } from '../../../../../constants/headers.js';
import type { AbcpClient } from '../createHtmlClient.js';
import { parseExternalOrderIdFromHtml } from '../utils/parseOrderId.js';
import type { CartPosition, IAbcpCartStrategy } from './abcpStrategy.types.js';

/**
 * Браузерные хедеры для финального шага подтверждения: сервер Mikano отдаёт HTML
 * только при обычной навигации (Accept: text/html), а не при AJAX (X-Requested-With).
 */
const BROWSER_NAV_HEADERS = {
  'User-Agent': abcpHeaders['User-Agent'],
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Encoding': abcpHeaders['Accept-Encoding'],
  'Accept-Language': abcpHeaders['Accept-Language'],
};

/** Стандартные строки корзины ABCP (сетка / упрощённая вёрстка), без темы MAS (cartItem). */
const DEFAULT_CART_ROW_SELECTOR = 'div.cartGridTable__row[data-id], div.cartTr[data-id]';

/**
 * Договор оформления: ABCP2 — agreementSelect / #agreementId; в скриптах — activeAgreements.
 * Общая логика для стандартной темы и MAS (одинаковый разбор полей на /cart).
 */
export const parseAbcpAgreementId = (html: string): string | null => {
  const $ = cheerio.load(html);
  const takeDigits = (v: unknown): string | null => {
    if (v == null) return null;
    const s = String(v).trim();
    return /^\d+$/.test(s) ? s : null;
  };

  const fromIdField = takeDigits($('#agreementId').val());
  if (fromIdField) return fromIdField;

  const fromAgreementSelect = takeDigits($('input[name="agreementSelect"]').val());
  if (fromAgreementSelect) return fromAgreementSelect;

  const fromDataAttr = takeDigits($('[data-agreement-id]').first().attr('data-agreement-id'));
  if (fromDataAttr) return fromDataAttr;

  const fromInput = takeDigits($('input[name="agreementId"]').val());
  if (fromInput) return fromInput;

  const fromSelect = takeDigits($('select[name="agreementId"]').val());
  if (fromSelect) return fromSelect;

  const masSelectVal = takeDigits(
    $('select')
      .filter((_i, el) => ($(el).attr('name') ?? '').toLowerCase().includes('agreement'))
      .first()
      .val(),
  );
  if (masSelectVal) return masSelectVal;

  const hiddenByName = $('input[type="hidden"]').filter((_i, el) => {
    const n = ($(el).attr('name') ?? '').toLowerCase();
    return n.includes('agreement');
  });
  for (let i = 0; i < hiddenByName.length; i++) {
    const v = takeDigits($(hiddenByName[i]).val());
    if (v) return v;
  }

  const activeAgreements = html.match(/activeAgreements\s*:\s*\{\s*"(\d+)"/);
  if (activeAgreements?.[1] && /^\d+$/.test(activeAgreements[1])) {
    return activeAgreements[1];
  }
  const scriptFallback = html.match(
    /["']agreementId["']\s*:\s*(\d+)|agreementId\s*[=:]\s*["']?(\d+)/i,
  );
  const fromScript = scriptFallback?.[1] ?? scriptFallback?.[2];
  if (fromScript && /^\d+$/.test(fromScript)) return fromScript;
  const attrMatch = html.match(/data-agreement-id\s*=\s*["']?(\d+)["']?/i);
  if (attrMatch?.[1]) return attrMatch[1];
  const masInline = html.match(
    /name=["'][^"']*agreement[^"']*["'][^>]*\bvalue=["'](\d+)["']/i,
  );
  if (masInline?.[1]) return masInline[1];
  const selectedInScript = html.match(
    /selectedAgreementId\s*[=:]\s*["']?(\d+)["']?|defaultAgreementId\s*[=:]\s*["']?(\d+)["']?/i,
  );
  const sid = selectedInScript?.[1] ?? selectedInScript?.[2];
  return sid && /^\d+$/.test(sid) ? sid : null;
};

const extractQuantityFromRow = ($row: cheerio.Cheerio<any>): number => {
  const selectValue = $row.find('select.quantitySelect').val();
  const inputQuantity = $row.find('input.quantityInput').val();
  const qtyBracket = $row.find('input[name^="quantity["]').val();
  const masQty = $row.find('input[name^="mas_quantity["]').val();
  const rawQty = (selectValue ?? inputQuantity ?? qtyBracket ?? masQty ?? '1') as string;
  return Math.max(1, parseInt(String(rawQty), 10) || 1);
};

/** Артикул: ссылка в ячейке номера, иначе весь текст ячейки .numberTd. */
const extractArticleFromMikanoRow = ($row: cheerio.Cheerio<any>): string => {
  const fromLink = $row.find('.numberTd a').first().text().trim();
  if (fromLink.length > 0) return fromLink;
  return $row.find('.numberTd').first().text().trim();
};

/**
 * Цена: приоритет data-price у .priceTd; иначе текст ячейки — только цифры и точка (пробелы и валюта отбрасываются).
 */
const extractPriceFromMikanoRow = ($row: cheerio.Cheerio<any>): number => {
  const $priceTd = $row.find('.priceTd').first();
  const dataPrice = $priceTd.attr('data-price')?.trim();
  if (dataPrice) {
    const n = parseFloat(dataPrice);
    if (Number.isFinite(n)) return n;
  }
  const raw = $priceTd.text().replace(/\s/g, '').replace(/[^\d.]/g, '');
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
};

const normalizeCheckoutUrl = (baseUrl: string, rawUrl: string): string => {
  const trimmed = rawUrl.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/')) return `${baseUrl}${trimmed}`;
  return `${baseUrl}/${trimmed}`;
};

/**
 * Извлечение данных о заказе из JSON-ответа createOrder.
 * Поставщик может отдавать orderId / orderNumber / amount / redirectUrl на разных уровнях вложенности.
 */
const extractCreateOrderData = (
  payload: unknown,
): { orderId: string | null; amount: string | null; redirectUrl: string | null } => {
  const result = { orderId: null as string | null, amount: null as string | null, redirectUrl: null as string | null };
  if (!payload || typeof payload !== 'object') return result;

  const json = JSON.stringify(payload);

  const orderIdMatch = json.match(/"order(?:Number|Id)"\s*:\s*"?(\d+)"?/i);
  if (orderIdMatch?.[1]) result.orderId = orderIdMatch[1];

  const amountMatch = json.match(/"amount"\s*:\s*"?(\d+(?:\.\d+)?)"?/i);
  if (amountMatch?.[1]) result.amount = amountMatch[1];

  const allStrings: string[] = [];
  const walk = (node: unknown, depth: number): void => {
    if (depth > 10) return;
    if (typeof node === 'string') { allStrings.push(node); return; }
    if (Array.isArray(node)) { node.forEach((v) => walk(v, depth + 1)); return; }
    if (node && typeof node === 'object') Object.values(node).forEach((v) => walk(v, depth + 1));
  };
  walk(payload, 0);

  for (const s of allStrings) {
    if (s.includes('payment_processing') || s.includes('redirectUrl') || s.includes('/cart')) {
      result.redirectUrl = s;
      const orderFromUrl = s.match(/[?&]orderId=(\d+)/i)?.[1];
      if (orderFromUrl && !result.orderId) result.orderId = orderFromUrl;
      const amountFromUrl = s.match(/[?&]amount=([\d.]+)/i)?.[1];
      if (amountFromUrl && !result.amount) result.amount = amountFromUrl;
      break;
    }
  }

  return result;
};

/**
 * Строит URL подтверждения payment_processing по реальным параметрам Mikano.
 * Порядок параметров: mode → agreementId → orderId → amount → orderCreated.
 */
const buildPaymentProcessingUrl = (
  baseUrl: string,
  opts: { agreementId?: string | null; orderId?: string | null; amount?: string | null },
): string => {
  const params = new URLSearchParams();
  params.set('mode', '3');
  if (opts.agreementId) params.set('agreementId', opts.agreementId);
  if (opts.orderId) params.set('orderId', opts.orderId);
  if (opts.amount) params.set('amount', opts.amount);
  params.set('orderCreated', '1');
  return `${baseUrl}/payment_processing?${params.toString()}`;
};

const isConfirmedCheckoutPage = (html: string): boolean => {
  const hasOrderConfirmed = /оформлен/i.test(html);
  const hasCheckoutMarkers =
    /(goToOrderButton|clients_orders|filter%5Bnumber%5D|Перейти в заказ|modeOrderWrapper)/i.test(html);
  return hasOrderConfirmed && hasCheckoutMarkers;
};

const extractOrderIdFromHtml = (html: string): string | null => {
  const fromParser = parseExternalOrderIdFromHtml(html);
  if (fromParser) return fromParser;
  const fromTitle = html.match(/Заказ(?:\s|&nbsp;|<[^>]+>)*№\s*(\d+)/i)?.[1];
  if (fromTitle) return fromTitle;
  const fromFilter = html.match(/filter%5Bnumber%5D=(\d+)/i)?.[1];
  return fromFilter ?? null;
};

export class MikanoCartStrategy implements IAbcpCartStrategy {
  parseAgreementId(html: string): string | null {
    return parseAbcpAgreementId(html);
  }

  extractPositions(html: string): CartPosition[] {
    const $ = cheerio.load(html);
    const rows = $(DEFAULT_CART_ROW_SELECTOR).toArray();
    const seen = new Set<number>();

    return rows
      .map((el) => {
        const $row = $(el);
        const id = Number($row.attr('data-id') ?? NaN);
        if (!Number.isFinite(id) || id <= 0 || seen.has(id)) return null;
        seen.add(id);
        return {
          id,
          quantity: extractQuantityFromRow($row),
          article: extractArticleFromMikanoRow($row),
          price: extractPriceFromMikanoRow($row),
        };
      })
      .filter((x): x is CartPosition => x != null);
  }

  async clearCart(
    client: AbcpClient,
    positions: CartPosition[],
    cartUrl: string,
  ): Promise<number> {
    if (positions.length === 0) return 0;
    const { baseUrl } = client.config;
    const url = `${baseUrl}/ajaxRoute/cart/deletePositions`;
    await client.makePostRequest(
      url,
      { positionIds: positions.map((p) => p.id) },
      {
        headers: {
          ...abcpHeaders,
          Accept: '*/*',
          'Content-Type': 'application/json; charset=UTF-8',
          Origin: baseUrl,
          Referer: cartUrl,
          'X-Requested-With': 'XMLHttpRequest',
        },
      },
    );
    return positions.length;
  }

  /**
   * Стандартный чекаут ABCP: deliveryMethods → JSON createOrder; при необходимости — номер из HTML редиректа.
   */
  async submitOrder(
    client: AbcpClient,
    positions: CartPosition[],
    agreementId: string | null,
    cartUrl: string,
  ): Promise<{ success: boolean; externalOrderId?: string; error?: string }> {
    const { baseUrl } = client.config;
    const positionIds = positions.map((p) => p.id);
    const positionsWithQuantities = positions.map((p) => ({ id: p.id, quantity: p.quantity }));

    const deliveryUrl = `${baseUrl}/ajaxRoute/cart/deliveryMethods`;
    const deliveryPayload = new URLSearchParams();
    for (const id of positionIds) deliveryPayload.append('positionIds[]', String(id));
    if (agreementId) {
      deliveryPayload.set('agreementId', agreementId);
    }

    try {
      await client.makePostRequest(deliveryUrl, deliveryPayload.toString(), {
        headers: {
          ...abcpHeaders,
          'Content-Type': 'application/x-www-form-urlencoded',
          Referer: cartUrl,
          'X-Requested-With': 'XMLHttpRequest',
        },
      });

      if (process.env.ABCP_ENABLE_REAL_ORDERS !== 'true') {
        return { success: true, externalOrderId: `dryrun-${Date.now()}` };
      }

      const createOrderUrl = `${baseUrl}/ajaxRoute/cart/createOrder`;
      const createBody: Record<string, unknown> = {
        positionIds,
        positionsWithQuantities,
        comment: '',
      };
      if (agreementId) {
        createBody.agreementId = Number(agreementId);
      }

      const createRes = await client.makePostRequest(createOrderUrl, createBody, {
        headers: {
          ...abcpHeaders,
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Origin: baseUrl,
          Referer: cartUrl,
          'X-Requested-With': 'XMLHttpRequest',
        },
      });

      const raw = createRes.data as unknown;

      logger.debug('[MikanoCheckout] createOrder raw response', {
        supplier: client.config.supplierName,
        responseType: typeof raw,
        data: typeof raw === 'string' ? raw.slice(0, 500) : raw,
      });

      if (typeof raw === 'string' && isConfirmedCheckoutPage(raw)) {
        const orderId = extractOrderIdFromHtml(raw);
        if (orderId) return { success: true, externalOrderId: orderId };
      }

      const record = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
      const status = record.status;
      if (status !== 1 && status !== '1' && status !== true) {
        const vendorError = String(record.error ?? record.message ?? 'Ошибка createOrder');
        return { success: false, error: vendorError };
      }

      const orderData = extractCreateOrderData(raw);
      const calculatedAmount = positions
        .reduce((sum, p) => sum + p.price * p.quantity, 0)
        .toFixed(2);

      const confirmationUrls: string[] = [];

      if (orderData.redirectUrl) {
        confirmationUrls.push(normalizeCheckoutUrl(baseUrl, orderData.redirectUrl));
      }

      if (orderData.orderId) {
        confirmationUrls.push(
          buildPaymentProcessingUrl(baseUrl, {
            agreementId,
            orderId: orderData.orderId,
            amount: orderData.amount ?? calculatedAmount,
          }),
        );
      }

      confirmationUrls.push(
        buildPaymentProcessingUrl(baseUrl, { agreementId }),
        `${baseUrl}/payment_processing`,
        `${baseUrl}/cart`,
      );

      const uniqueUrls = Array.from(new Set(confirmationUrls));

      logger.debug('[MikanoCheckout] Confirmation URLs to try', {
        supplier: client.config.supplierName,
        orderData,
        calculatedAmount,
        urls: uniqueUrls,
      });

      for (const url of uniqueUrls) {
        const finalRes = await client.makeRequest(url, {
          headers: { ...BROWSER_NAV_HEADERS, Referer: cartUrl },
        });
        const finalHtml = String(finalRes.data ?? '');

        logger.debug('[MikanoCheckout] Confirmation page response', {
          supplier: client.config.supplierName,
          url,
          htmlLength: finalHtml.length,
          hasОформлен: /оформлен/i.test(finalHtml),
          snippet: finalHtml.slice(0, 300),
        });

        if (isConfirmedCheckoutPage(finalHtml)) {
          const orderId = extractOrderIdFromHtml(finalHtml) ?? orderData.orderId;
          if (orderId) return { success: true, externalOrderId: orderId };
        }
      }

      return {
        success: false,
        error:
          'Заказ отправлен (createOrder status=1), но финальное HTML-подтверждение не получено ни по одному URL',
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }
}

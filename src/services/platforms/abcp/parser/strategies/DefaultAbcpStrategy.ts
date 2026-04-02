import * as cheerio from 'cheerio';

import { abcpHeaders } from '../../../../../constants/headers.js';
import type { AbcpClient } from '../createHtmlClient.js';
import { parseExternalOrderIdFromHtml } from '../utils/parseOrderId.js';
import type { CartPosition, IAbcpCartStrategy } from './types.js';

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

export class DefaultAbcpStrategy implements IAbcpCartStrategy {
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
        return { id, quantity: extractQuantityFromRow($row) };
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
      const status = (raw as { status?: unknown })?.status;
      if (status !== 1) {
        const vendorError = String(
          (raw as { error?: unknown; message?: unknown })?.error ??
            (raw as { message?: unknown })?.message ??
            'Ошибка createOrder',
        );
        return { success: false, error: vendorError };
      }

      const orderNumber = (raw as { orderNumber?: unknown })?.orderNumber;
      const redirectUrl = (raw as { redirectUrl?: string })?.redirectUrl;

      if (orderNumber != null && String(orderNumber).trim().length > 0) {
        return { success: true, externalOrderId: String(orderNumber) };
      }

      if (redirectUrl) {
        const finalUrl = redirectUrl.startsWith('http')
          ? redirectUrl
          : `${baseUrl}${redirectUrl}`;
        const finalRes = await client.makeRequest(finalUrl, { headers: abcpHeaders });
        const finalHtml = String(finalRes.data ?? '');
        const parsed = parseExternalOrderIdFromHtml(finalHtml);
        if (parsed) {
          return { success: true, externalOrderId: parsed };
        }
      }

      return {
        success: false,
        error:
          'Заказ отправлен, но номер заказа не найден ни в JSON-ответе, ни на странице подтверждения',
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }
}

import * as cheerio from 'cheerio';
import { logger } from '../../../../config/logger/index.js';
import { abcpHeaders } from '../../../../constants/headers.js';
import { yieldToEventLoop } from '../../../../utils/yieldToEventLoop.js';
import { autoImpulseClient } from '../../../suppliers/autoImpulse/client.js';
import { mikanoClient } from '../../../suppliers/mikano/client.js';

type AbcpClient = ReturnType<typeof import('./createHtmlClient.js').createHtmlClient>;

export type SubmitAbcpOrderResult =
  | { success: true; externalOrderId: string }
  | { success: false; error: string };

export type ClearAbcpCartHtmlResult =
  | { success: true; removedCount: number }
  | { success: false; error: string };

/** Маппинг имени поставщика → синглтон-клиент из suppliers/. */
const clientMap: Record<string, AbcpClient> = {
  mikano: mikanoClient,
  autoImpulse: autoImpulseClient,
};

const resolveClient = (supplierName: string): AbcpClient => {
  const client = clientMap[supplierName];
  if (!client) {
    throw new Error(`ABCP-клиент для поставщика «${supplierName}» не найден`);
  }
  return client;
};

const debugAbcpCart = (message: string, meta?: Record<string, unknown>): void => {
  if (process.env.DEBUG_ABCP_CART === 'true') {
    logger.debug(`[ABCP cart] ${message}`, meta ?? {});
  }
};

/** Склеивает Location из 302 с origin сайта (ABCP отдаёт относительный путь). */
const resolveRedirectLocation = (baseUrl: string, location: string): string => {
  if (location.startsWith('http://') || location.startsWith('https://')) {
    return location;
  }
  const origin = new URL(baseUrl).origin;
  return `${origin}${location.startsWith('/') ? location : `/${location}`}`;
};

/** Селектор строк корзины: темы ABCP отличаются (сетка / cartTr / cartItem). */
const ABCP_CART_ROW_SELECTOR =
  'div.cartGridTable__row[data-id], div.cartTr[data-id], div.cartItem[data-id]';

/**
 * Договор оформления: ABCP2 — agreementSelect / #agreementId; тема MAS (autoImpulse) — mas_* или скрытые поля;
 * в скриптах — activeAgreements: {"18":{....
 */
const parseAgreementId = (html: string): string | null => {
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

  // Тема MAS: select с именем вроде mas_agreementId, mas_agreementSelect
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
  // MAS: value рядом с именем поля договора в одной строке разметки
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

/**
 * ID позиций на /cart для разных тем ABCP: сетка, упрощённая вёрстка (cartTr), autoImpulse (cartItem).
 */
const extractAbcpCartPositionIds = (html: string): number[] => {
  const $ = cheerio.load(html);
  const rows = $(ABCP_CART_ROW_SELECTOR).toArray();
  const seen = new Set<number>();
  for (const el of rows) {
    const id = Number($(el).attr('data-id') ?? NaN);
    if (Number.isFinite(id) && id > 0 && !seen.has(id)) seen.add(id);
  }
  return [...seen];
};

const parseCartPositions = (
  html: string,
): Array<{ id: number; quantity: number }> => {
  const $ = cheerio.load(html);
  const rows = $(ABCP_CART_ROW_SELECTOR).toArray();

  return rows
    .map((el) => {
      const $row = $(el);
      const id = Number($row.attr('data-id') ?? NaN);
      if (!Number.isFinite(id) || id <= 0) return null;

      const selectValue = $row.find('select.quantitySelect').val();
      const inputQuantity = $row.find('input.quantityInput').val();
      const qtyBracket = $row.find('input[name^="quantity["]').val();
      const masQty = $row.find('input[name^="mas_quantity["]').val();
      const rawQty = (selectValue ??
        inputQuantity ??
        qtyBracket ??
        masQty ??
        '1') as string;
      const quantity = Math.max(1, parseInt(String(rawQty), 10) || 1);

      return { id, quantity };
    })
    .filter((x): x is { id: number; quantity: number } => x != null);
};

const parseExternalOrderIdFromHtml = (html: string): string | null => {
  // Примеры: "Заказ № 1429 оформлен." / "Заказ №12345 успешно оформлен"
  const match = html.match(/Заказ\s*№?\s*(\d+)/i);
  return match?.[1] ?? null;
};

const buildDryRunOrderId = (): string =>
  `dryrun-${Date.now()}`;

/** Accept для навигационных GET на /cart (тема MAS / autoImpulse — удаление через removepos). */
const abcpHtmlNavigationAccept =
  'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8';

/**
 * Удаляет одну позицию: mikano — JSON ajaxRoute; autoImpulse (MAS) — два GET, иначе JSON на их стороне
 * не снимает позиции и корзина копится при повторном добавлении.
 */
const deleteOneAbcpCartPosition = async (
  supplierName: string,
  client: AbcpClient,
  positionId: number,
  cartUrl: string,
): Promise<void> => {
  const { baseUrl } = client.config;

  if (supplierName === 'autoImpulse') {
    const initiateUrl = `${baseUrl}/cart/?removepos=${encodeURIComponent(String(positionId))}`;
    const redirectAwareOpts = {
      headers: {
        ...abcpHeaders,
        Accept: abcpHtmlNavigationAccept,
        Referer: cartUrl,
      },
      maxRedirects: 0,
      validateStatus: (status: number) =>
        (status >= 200 && status < 300) || (status >= 300 && status < 400),
    };
    const res1 = await client.makeRequest(initiateUrl, redirectAwareOpts);
    debugAbcpCart('autoImpulse removepos', {
      positionId,
      status: res1.status,
      location: res1.headers?.location,
    });
    await yieldToEventLoop();
    const loc = res1.headers?.location;
    const confirmUrl =
      res1.status >= 300 && res1.status < 400 && loc
        ? resolveRedirectLocation(baseUrl, loc)
        : `${baseUrl}/cart?removePos`;
    await client.makeRequest(confirmUrl, {
      headers: {
        ...abcpHeaders,
        Accept: abcpHtmlNavigationAccept,
        Referer: initiateUrl,
      },
    });
    return;
  }

  const url = `${baseUrl}/ajaxRoute/cart/deletePositions`;
  await client.makePostRequest(
    url,
    { positionIds: [positionId] },
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
};

/**
 * Полная очистка корзины ABCP перед ручным чекаутом: GET /cart, разбор data-id, по одному удалению на позицию.
 *
 * Поток: сессия через тот же HTML-клиент, что и оформление заказа; при пустой корзине — выход без запросов удаления.
 */
export const clearAbcpCartHtml = async (
  supplierName: string,
): Promise<ClearAbcpCartHtmlResult> => {
  const client = resolveClient(supplierName);
  const { baseUrl } = client.config;

  try {
    const cartUrl = `${baseUrl}/cart`;
    const cartRes = await client.makeRequest(cartUrl, { headers: abcpHeaders });
    const cartHtml = String(cartRes.data ?? '');

    await yieldToEventLoop();

    const positionIds = extractAbcpCartPositionIds(cartHtml);
    debugAbcpCart('clearAbcpCartHtml', { supplier: supplierName, positionCount: positionIds.length });
    if (positionIds.length === 0) {
      return { success: true, removedCount: 0 };
    }

    let removedCount = 0;
    for (const positionId of positionIds) {
      await deleteOneAbcpCartPosition(supplierName, client, positionId, cartUrl);
      removedCount += 1;
      await yieldToEventLoop();
    }

    return { success: true, removedCount };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
};

/**
 * Финальное оформление заказа на ABCP-сайте (AJAX checkout).
 *
 * Поток данных:
 *  1) GET /cart → парсинг positionIds + quantities + agreementId.
 *  2) (опционально) POST /ajaxRoute/cart/deliveryMethods — прогрев шага доставки (некоторые ABCP-инстансы
 *     без этого могут не дать оформить).
 *  3) Safety lock: если ABCP_ENABLE_REAL_ORDERS !== 'true' — не вызываем createOrder, возвращаем фейковый id.
 *  4) POST /ajaxRoute/cart/createOrder (JSON) → { status: 1, orderNumber, redirectUrl }.
 *  5) GET redirectUrl (если есть) → парсинг "Заказ № ...".
 *
 * Важно: функция вызывается после того, как позиции уже добавлены в корзину поставщика.
 */
export const submitAbcpOrderHtml = async (
  supplierName: string,
  sessionTokens?: unknown,
): Promise<SubmitAbcpOrderResult> => {
  // sessionTokens сейчас не используется: cookie-сессия хранится внутри клиента поставщика.
  // Параметр оставлен для совместимости с вызывающим кодом, где токены могут появиться позже.
  void sessionTokens;

  const client = resolveClient(supplierName);
  const { baseUrl } = client.config;

  try {
    // ── 1) GET /cart ─────────────────────────────────────────────────────
    const cartUrl = `${baseUrl}/cart`;
    const cartRes = await client.makeRequest(cartUrl, { headers: abcpHeaders });
    const cartHtml = String(cartRes.data ?? '');

    await yieldToEventLoop();

    debugAbcpCart('submit GET /cart', {
      supplier: supplierName,
      htmlLength: cartHtml.length,
    });
    const agreementId = parseAgreementId(cartHtml);
    if (!agreementId) {
      debugAbcpCart('agreementId не найден', {
        supplier: supplierName,
        agreementSubstrings: (cartHtml.match(/agreement/gi) ?? []).length,
      });
      return { success: false, error: 'Не найден agreementId на странице /cart' };
    }
    debugAbcpCart('agreementId', { supplier: supplierName, agreementId });

    const cartPositions = parseCartPositions(cartHtml);
    if (cartPositions.length === 0) {
      return { success: false, error: 'Корзина пуста или не удалось распарсить позиции на /cart' };
    }

    const positionIds = cartPositions.map((p) => p.id);
    const positionsWithQuantities = cartPositions.map((p) => ({ id: p.id, quantity: p.quantity }));

    // ── 2) deliveryMethods (лучше дернуть перед createOrder) ─────────────
    const deliveryUrl = `${baseUrl}/ajaxRoute/cart/deliveryMethods`;
    const deliveryPayload = new URLSearchParams();
    for (const id of positionIds) deliveryPayload.append('positionIds[]', String(id));
    deliveryPayload.set('agreementId', agreementId);

    await client.makePostRequest(deliveryUrl, deliveryPayload.toString(), {
      headers: {
        ...abcpHeaders,
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: cartUrl,
        'X-Requested-With': 'XMLHttpRequest',
      },
    });

    // ── 3) Safety lock ──────────────────────────────────────────────────
    if (process.env.ABCP_ENABLE_REAL_ORDERS !== 'true') {
      return { success: true, externalOrderId: buildDryRunOrderId() };
    }

    // ── 4) createOrder ──────────────────────────────────────────────────
    const createOrderUrl = `${baseUrl}/ajaxRoute/cart/createOrder`;
    const createBody = {
      positionIds,
      positionsWithQuantities,
      comment: '',
      agreementId: Number(agreementId),
    };

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
    const status = (raw as any)?.status;
    if (status !== 1) {
      const vendorError = String((raw as any)?.error ?? (raw as any)?.message ?? 'Ошибка createOrder');
      return { success: false, error: vendorError };
    }

    const orderNumber = (raw as any)?.orderNumber;
    const redirectUrl = (raw as any)?.redirectUrl as string | undefined;

    if (orderNumber != null && String(orderNumber).trim().length > 0) {
      return { success: true, externalOrderId: String(orderNumber) };
    }

    // ── 5) Фолбэк: парсим из HTML редиректа ──────────────────────────────
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
      error: 'Заказ отправлен, но номер заказа не найден ни в JSON-ответе, ни на странице подтверждения',
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
};


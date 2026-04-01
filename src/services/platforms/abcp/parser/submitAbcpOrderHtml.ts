import * as cheerio from 'cheerio';
import { abcpHeaders } from '../../../../constants/headers.js';
import { yieldToEventLoop } from '../../../../utils/yieldToEventLoop.js';
import { autoImpulseClient } from '../../../suppliers/autoImpulse/client.js';
import { mikanoClient } from '../../../suppliers/mikano/client.js';

type AbcpClient = ReturnType<typeof import('./createHtmlClient.js').createHtmlClient>;

export type SubmitAbcpOrderResult =
  | { success: true; externalOrderId: string }
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

const parseAgreementId = (html: string): string | null => {
  const match = html.match(/data-agreement-id=["']?(\d+)["']?/i);
  return match?.[1] ?? null;
};

const parseCartPositions = (
  html: string,
): Array<{ id: number; quantity: number }> => {
  const $ = cheerio.load(html);
  const rows = $('div.cartGridTable__row.cartTr[data-id]').toArray();

  return rows
    .map((el) => {
      const $row = $(el);
      const id = Number($row.attr('data-id') ?? NaN);
      if (!Number.isFinite(id) || id <= 0) return null;

      const selectValue = $row.find('select.quantitySelect').val();
      const inputValue = $row.find('input.quantityInput').val();
      const rawQty = (selectValue ?? inputValue ?? '1') as string;
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

    const agreementId = parseAgreementId(cartHtml);
    if (!agreementId) {
      return { success: false, error: 'Не найден agreementId на странице /cart' };
    }

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


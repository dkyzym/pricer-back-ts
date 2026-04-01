import axios, { AxiosError } from 'axios';
import { Logger } from 'winston';
import { ICartItemDocument } from '../../../models/CartItem.js';
import type { SearchResultsParsed } from '../../../types/search.types.js';
import { CheckoutHandler, CheckoutResult } from '../../orchestration/cart/cart.types.js';
import { SearchResponseItem } from './armtek.types.js';

/** Сырое rawItemData: ответ WS или нормализованный результат после актуализации (parseArmtekResults). */
type CartArmtekRaw = Partial<SearchResponseItem> & Partial<SearchResultsParsed>;

/**
 * KEYZAK в заказе = warehouse_id в SearchResultsParsed (см. parseArmtekResults, findExactMatch в actualizeCartItems).
 */
const extractSavedArmtekKeyzak = (raw: unknown): string | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as CartArmtekRaw;
  const fromWs = o.KEYZAK?.trim();
  const wid = o.warehouse_id;
  const fromParsed =
    typeof wid === 'string' ? wid.trim() : wid != null ? String(wid).trim() : '';
  const v = fromWs || fromParsed;
  return v || undefined;
};

/** ARTID в WS = inner_product_code после парсинга в корзину. */
const extractSavedArmtekArtid = (raw: unknown): string | undefined => {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as CartArmtekRaw;
  const fromWs = o.ARTID?.trim();
  const ipc = o.inner_product_code;
  const fromParsed =
    typeof ipc === 'string' ? ipc.trim() : ipc != null ? String(ipc).trim() : '';
  const v = fromWs || fromParsed;
  return v || undefined;
};

const pricesRoughlyEqual = (a: number, b: number, eps = 0.02): boolean =>
  Math.abs(a - b) <= eps;

const ARMTEK_BASE_URL =
  process.env.ARMTEK_BASE_URL?.trim().replace(/\/+$/, '');

/**
 * ТЕСТОВЫЙ endpoint для создания заказа — НЕ создаёт реальных финансовых обязательств.
 * При переходе в прод заменить `createTestOrder` на `createOrder`.
 */

/** Элемент ITEMS для createOrder / createTestOrder (armtek-ws-api.md §3.1). */
type ArmtekCreateOrderItem = {
  PIN: string;
  BRAND: string;
  KWMENG: number;
  KEYZAK?: string;
};

/** Тело POST: как в CreateOrderRequest — поле покупателя KUNRG, не KUNNR_RG (то только для ws_search/search). */
interface ArmtekCreateOrderPayload {
  VKORG: string;
  KUNRG: string;
  DBTYP: '1' | '2' | '3';
  ITEMS: ArmtekCreateOrderItem[];
}

interface ArmtekCreateOrderResultRow {
  VBELN?: string;
}

interface ArmtekCreateOrderResultItem {
  RESULT?: ArmtekCreateOrderResultRow[];
  /** Ненулевое значение — позиция не оформлена (см. ERROR_MESSAGE). */
  ERROR?: number | string;
  ERROR_MESSAGE?: string;
}

/** RESP успешного createOrder — см. CreateOrderResponse в документации. */
interface ArmtekCreateOrderRespBody {
  ITEMS?: ArmtekCreateOrderResultItem[];
}

interface ArmtekOrderApiEnvelope {
  STATUS: number;
  MESSAGES?: { TYPE: string; TEXT: string }[];
  RESP: ArmtekCreateOrderRespBody | null;
}

/** KUNRG / KUNNR: значение из .env как в Armtek (без padStart — иначе другой контрагент). */
const resolveArmtekKunrg = (): string =>
  process.env.ARMTEK_KUNNR?.trim() ||
  process.env.KUNNR?.trim() ||
  process.env.ARMTEK_KUNRG?.trim() ||
  process.env.KUNRG?.trim() ||
  '43054443';

const resolveArmtekVkorg = (): string => process.env.VKORG?.trim() || '4000';

/** Тексты MESSAGES с TYPE === E (ошибка API при HTTP 200). */
const collectArmtekErrorTexts = (
  messages: ArmtekOrderApiEnvelope['MESSAGES'],
): string => {
  const fromErrors = messages?.filter((m) => m.TYPE === 'E').map((m) => m.TEXT) ?? [];
  if (fromErrors.length > 0) return fromErrors.join('; ');
  const any = messages?.map((m) => m.TEXT).filter(Boolean) ?? [];
  return any.join('; ') || 'Неизвестная ошибка';
};

const collectVbelnsFromCreateOrderResp = (
  resp: ArmtekCreateOrderRespBody | null | undefined,
): string[] => {
  if (!resp?.ITEMS?.length) return [];
  const ids: string[] = [];
  for (const line of resp.ITEMS) {
    const rows = line.RESULT ?? [];
    for (const row of rows) {
      if (row.VBELN) ids.push(row.VBELN);
    }
  }
  return ids;
};

const normalizeBrandKey = (b: string | undefined): string =>
  (b ?? '').trim().toUpperCase();

/**
 * Выбор строки из свежего search в духе actualizeCartItems.findExactMatch:
 * warehouse_id/KEYZAK → ARTID/inner_product_code → цена из корзины (несколько строк с одной ценой) → бренд.
 */
const pickSearchRowForCartItem = (
  rows: SearchResponseItem[],
  item: ICartItemDocument,
): SearchResponseItem | undefined => {
  if (!rows.length) return undefined;

  let pool = rows;
  const savedKeyzak = extractSavedArmtekKeyzak(item.rawItemData);
  const savedArtid = extractSavedArmtekArtid(item.rawItemData);
  const cartBrand = normalizeBrandKey(item.brand);
  const cartPriceRaw = item.currentPrice ?? item.initialPrice;
  const cartPrice =
    cartPriceRaw != null && !Number.isNaN(Number(cartPriceRaw))
      ? Number(cartPriceRaw)
      : null;

  if (savedKeyzak) {
    const byKey = pool.filter((r) => r.KEYZAK?.trim() === savedKeyzak);
    if (byKey.length === 0) return undefined;
    pool = byKey;
  }

  if (savedArtid) {
    const byArt = pool.filter((r) => String(r.ARTID ?? '').trim() === savedArtid);
    if (byArt.length === 1) return byArt[0];
    if (byArt.length === 0) return undefined;
    pool = byArt;
  }

  if (pool.length > 1 && cartPrice != null) {
    const byPrice = pool.filter((r) => {
      const p = r.PRICE != null && String(r.PRICE).trim() !== ''
        ? parseFloat(String(r.PRICE).replace(',', '.'))
        : NaN;
      return !Number.isNaN(p) && pricesRoughlyEqual(p, cartPrice);
    });
    if (byPrice.length === 1) return byPrice[0];
    if (byPrice.length > 0) pool = byPrice;
  }

  if (cartBrand && pool.length > 1) {
    const byBrand = pool.filter((r) => normalizeBrandKey(r.BRAND) === cartBrand);
    if (byBrand.length === 1) return byBrand[0];
    if (byBrand.length > 0) pool = byBrand;
  }

  if (pool.length === 1) return pool[0];

  const withKeyzak = pool.find((r) => r.KEYZAK?.trim());
  return withKeyzak ?? pool[0];
};


/** Ошибки уровня строки в RESP.ITEMS (не дублируют MESSAGES). */
const collectLineLevelOrderErrors = (data: ArmtekOrderApiEnvelope): string[] => {
  const lines = data.RESP?.ITEMS ?? [];
  const out: string[] = [];
  for (const line of lines) {
    const msg = line.ERROR_MESSAGE?.trim();
    const ev = line.ERROR;
    const n =
      typeof ev === 'number'
        ? ev
        : typeof ev === 'string' && ev !== '' && !Number.isNaN(Number(ev))
          ? Number(ev)
          : 0;
    if (msg) {
      out.push(msg);
      continue;
    }
    if (n !== 0) out.push(`Ошибка позиции заказа (ERROR=${String(ev)})`);
  }
  return out;
};

const isArmtekApiLogicalFailure = (data: ArmtekOrderApiEnvelope): boolean => {
  if (data.STATUS !== 200) return true;
  if (data.RESP == null) return true;
  if (data.MESSAGES?.some((m) => m.TYPE === 'E')) return true;
  return false;
};

/**
 * Сериализация тела ответа для логов: без циклов, с отступами (удобно копировать из консоли).
 */
const safeJsonStringify = (value: unknown): string => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

/**
 * Адаптер оформления заказа Armtek (тестовый endpoint).
 *
 * Поток данных:
 *  1. VKORG / KUNRG из .env без изменения строки (trim только у переменных).
 *  2. ws_search/search по каждой позиции → ITEMS с PIN, BRAND, KEYZAK из ответа (тот же KUNNR_RG, что в .env).
 *  3. POST createTestOrder; провал при MESSAGES.E, пустом RESP, ERROR/ERROR_MESSAGE в строках.
 *  4. Номера заказов: RESP.ITEMS[].RESULT[].VBELN.
 */
export const armtekCheckoutHandler: CheckoutHandler = async (
  items: ICartItemDocument[],
  userLogger: Logger,
): Promise<CheckoutResult> => {
  const cartItemIds = items.map((i) => String(i._id));

  if (items.length === 0) {
    return { success: true, cartItemIds, externalOrderIds: [] };
  }

  const KUNRG = resolveArmtekKunrg();
  if (!KUNRG) {
    userLogger.error('[ArmtekCheckout] Не задан номер покупателя (KUNNR / ARMTEK_KUNNR / KUNRG в .env)');
    return {
      success: false,
      cartItemIds,
      error: 'Armtek: не настроен KUNRG (задайте KUNNR или ARMTEK_KUNNR в .env)',
    };
  }

  const vkorg = resolveArmtekVkorg();
  const orderItems: ArmtekCreateOrderItem[] = items.map((item) => {
    const pin = String(item.article ?? '').trim();
    const brand = String(item.brand ?? '').trim();
    // Берем склад из сохраненных данных корзины. Если его нет, передаем пустую строку,
    // чтобы API искало на основном складе, как было в успешном изолированном тесте.
    const keyzak = extractSavedArmtekKeyzak(item.rawItemData) || '';
    const qty = Math.max(1, Math.floor(Number(item.quantity)) || 1);

    if (!pin) {
      throw new Error('Armtek: в позиции корзины пустой артикул');
    }

    return { PIN: pin, BRAND: brand, KWMENG: qty, KEYZAK: keyzak };
  });

  const payload: ArmtekCreateOrderPayload = {
    VKORG: vkorg,
    KUNRG,DBTYP:'3',
    ITEMS: orderItems,
  };

  try {
    const response = await axios.post<ArmtekOrderApiEnvelope>(
      `${ARMTEK_BASE_URL}/api/ws_order/createTestOrder?format=json`,
      payload,
      {
        headers: { 'Content-Type': 'application/json' },
        auth: {
          username: process.env.ARMTEK_USERNAME || '',
          password: process.env.ARMTEK_PASSWORD || '',
        },
      },
    );

    const data = response.data;
    const createTestOrderUrl = `${ARMTEK_BASE_URL}/api/ws_order/createTestOrder?format=json`;

    // Явная трассировка: любой HTTP-ответ от WS (успех/логическая ошибка — одно и то же тело).
    userLogger.info('[ArmtekCheckout] Полный ответ createTestOrder', {
      endpoint: createTestOrderUrl,
      httpStatus: response.status,
      httpStatusText: response.statusText,
      responseHeaders: { ...response.headers },
      requestPayload: payload,
      responseBody: data,
      responseBodyPretty: safeJsonStringify(data),
    });

    if (isArmtekApiLogicalFailure(data)) {
      const errorText = collectArmtekErrorTexts(data.MESSAGES);
      userLogger.error('[ArmtekCheckout] Логическая ошибка API (после разбора тела)', {
        STATUS: data.STATUS,
        MESSAGES: data.MESSAGES,
        RESP: data.RESP,
        errorText,
      });
      return { success: false, cartItemIds, error: errorText };
    }

    const lineErrors = collectLineLevelOrderErrors(data);
    if (lineErrors.length > 0) {
      const errorText = lineErrors.join('; ');
      userLogger.error('[ArmtekCheckout] Ошибки по строкам заказа (RESP.ITEMS)', {
        lineErrors,
      });
      return { success: false, cartItemIds, error: errorText };
    }

    const externalOrderIds = collectVbelnsFromCreateOrderResp(data.RESP);

    userLogger.info('[ArmtekCheckout] Разбор успешного ответа', {
      externalOrderIds,
      extractedVbelnCount: externalOrderIds.length,
    });

    return { success: true, cartItemIds, externalOrderIds };
  } catch (error: unknown) {
    const message =
      error instanceof AxiosError
        ? `Armtek request failed: ${error.message}`
        : `Armtek unexpected error: ${String(error)}`;

    if (error instanceof AxiosError) {
      userLogger.error('[ArmtekCheckout] Axios: полный контекст сбоя (ответ сервера при наличии)', {
        axiosMessage: error.message,
        axiosCode: error.code,
        requestUrl: error.config?.url,
        requestMethod: error.config?.method,
        requestPayload: payload,
        responseHttpStatus: error.response?.status,
        responseHttpStatusText: error.response?.statusText,
        responseHeaders: error.response?.headers
          ? { ...error.response.headers }
          : undefined,
        responseBody: error.response?.data,
        responseBodyPretty:
          error.response?.data !== undefined
            ? safeJsonStringify(error.response.data)
            : undefined,
      });
    } else {
      userLogger.error('[ArmtekCheckout] Исключение при создании заказа (не Axios)', {
        error: message,
        requestPayload: payload,
      });
    }

    return { success: false, cartItemIds, error: message };
  }
};

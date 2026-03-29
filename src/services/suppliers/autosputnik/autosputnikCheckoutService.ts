import axios, { AxiosError } from 'axios';
import { Logger } from 'winston';
import { ICartItemDocument } from '../../../models/CartItem.js';
import { CheckoutHandler, CheckoutResult } from '../../orchestration/cart/cart.types.js';
import { BASE_URL, getToken, tokenCache } from './autosputnikApi.js';

type AutosputnikAlias = 'autosputnik' | 'autosputnik_bn';

// ─────────────────────────────────────────────────────────────────────────────
//  Типы ответов Basket API
// ─────────────────────────────────────────────────────────────────────────────

interface AutosputnikBasketProduct {
  id: number;
  articul: string | null;
  brand: string | null;
  name: string | null;
  brandid: number;
  userid: number;
  price: number;
  quantity: number;
  amount: number;
  id_shop_prices: number;
  comment: string | null;
}

interface AutosputnikBasketResponse {
  error: string | null;
  data: AutosputnikBasketProduct[];
}

interface AutosputnikBasketAddPayload {
  articul: string;
  brandid: number;
  quantity: number;
  price: number;
  id_shop_prices: number;
  comment?: string | null;
}

/** Ответ POST /order/create — см. OrderViewModelRequestcs в документации Autosputnik. */
interface AutosputnikOrderCreateResponse {
  error: string | null;
  countorders: number;
  totalpages: number;
  data: Array<{ id: number; userid?: number; date?: string; comment?: string | null }> | null;
}

/** Тело POST /order/create: в OAS указан только comment; доп. поля — опционально через env. */
type AutosputnikCreateOrderBody = {
  comment?: string | null;
  delivery_method?: string;
  payment_type?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
//  Извлечение полей из rawItemData для basket/add
// ─────────────────────────────────────────────────────────────────────────────

interface AutosputnikRawFields {
  articul: string;
  brandid: number;
  id_shop_prices: number;
  price: number;
}

/**
 * rawItemData хранит SearchResultsParsed, где:
 *   article           → articul (артикул товара)
 *   [supplier].brand  → brandid (ID бренда в системе Autosputnik, строка → число)
 *   [supplier].id_shop_prices → id_shop_prices (ID склада, строка → число)
 *   price             → price (цена, fallback на currentPrice / initialPrice из документа)
 */
const extractAutosputnikFields = (
  item: ICartItemDocument,
  supplier: AutosputnikAlias,
): AutosputnikRawFields | null => {
  const raw = item.rawItemData as Record<string, unknown> | undefined;
  if (!raw) return null;

  const nested = raw[supplier] as
    | { brand?: string; id_shop_prices?: string }
    | undefined;

  const articul = (raw.article as string) ?? item.article;
  const brandid = nested?.brand != null ? Number(nested.brand) : NaN;
  const idShopPrices =
    nested?.id_shop_prices != null ? Number(nested.id_shop_prices) : NaN;
  const price =
    (raw.price as number) ?? item.currentPrice ?? item.initialPrice;

  if (!articul || isNaN(brandid) || isNaN(idShopPrices) || price == null) {
    return null;
  }

  return { articul, brandid, id_shop_prices: idShopPrices, price: Number(price) };
};

/** Пустая/null error у поставщика считается успехом (см. документацию Autosputnik). */
const normalizeAutosputnikError = (e: string | null | undefined): string | null => {
  if (e == null) return null;
  const t = String(e).trim();
  return t.length === 0 ? null : t;
};

/**
 * Сборка тела POST /order/create: базово только comment; delivery/payment — если заданы в env
 * (в Swagger v1 может не быть — поля не отправляем, чтобы не ломать контракт).
 */
const buildCreateOrderPayload = (): AutosputnikCreateOrderBody => {
  const comment = process.env.AUTOSPUTNIK_ORDER_COMMENT?.trim();
  const delivery_method = process.env.AUTOSPUTNIK_ORDER_DELIVERY_METHOD?.trim();
  const payment_type = process.env.AUTOSPUTNIK_ORDER_PAYMENT_TYPE?.trim();
  const body: AutosputnikCreateOrderBody = {};
  if (comment) body.comment = comment;
  if (delivery_method) body.delivery_method = delivery_method;
  if (payment_type) body.payment_type = payment_type;
  return body;
};

/**
 * Строгая проверка ответа создания заказа: не полагаемся на HTTP 200.
 * Возвращает список id заказов из data или текст ошибки поставщика.
 */
const parseOrderCreateResult = (
  raw: AutosputnikOrderCreateResponse,
): { ok: true; orderIds: string[] } | { ok: false; vendorMessage: string } => {
  const err = normalizeAutosputnikError(raw.error);
  if (err) {
    return { ok: false, vendorMessage: err };
  }
  const rows = raw.data;
  if (!Array.isArray(rows) || rows.length === 0) {
    return {
      ok: false,
      vendorMessage: 'Ответ order/create: пустой data или заказ не создан',
    };
  }
  const ids = rows
    .map((o) => o.id)
    .filter((id): id is number => typeof id === 'number' && !Number.isNaN(id));
  if (ids.length === 0) {
    return {
      ok: false,
      vendorMessage: 'Ответ order/create: отсутствует числовой id заказа в data',
    };
  }
  return { ok: true, orderIds: ids.map(String) };
};

// ─────────────────────────────────────────────────────────────────────────────
//  HTTP-обёртка с авто-перевыпуском токена при 401
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Паттерн «Retry-on-401»: при получении 401 — сбрасывает кэш токена,
 * запрашивает свежий и повторяет вызов один раз.
 */
const authedPost = async <T>(
  path: string,
  supplier: AutosputnikAlias,
  body?: unknown,
): Promise<T> => {
  const makeRequest = async (token: string) => {
    const { data } = await axios.post<T>(`${BASE_URL}${path}`, body ?? {}, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      timeout: 15_000,
    });
    return data;
  };

  const token = await getToken(supplier);
  try {
    return await makeRequest(token);
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 401) {
      tokenCache.delete(supplier);
      const freshToken = await getToken(supplier);
      return makeRequest(freshToken);
    }
    throw err;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  Экспортируемый CheckoutHandler
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Адаптер оформления заказа Autosputnik.
 *
 * Поток данных:
 *  1. POST /basket/clear — полная очистка корзины поставщика (идемпотентно).
 *  2. POST /basket/add для каждой позиции — articul, brandid, id_shop_prices,
 *     price извлекаются из rawItemData[supplier]; аудит: полный payload и тело ответа в лог.
 *  3. Если AUTOSPUTNIK_ENABLE_REAL_ORDERS !== 'true' — стоп: корзина у поставщика заполнена,
 *     POST /order/create не вызывается (safety lock).
 *  4. Иначе POST /order/create — создание заказа из корзины; проверка поля error и id в data.
 *
 * Один handler обслуживает оба контура (autosputnik / autosputnik_bn) —
 * алиас определяется из item.supplier.
 */
export const autosputnikCheckoutHandler: CheckoutHandler = async (
  items: ICartItemDocument[],
  userLogger: Logger,
): Promise<CheckoutResult> => {
  const cartItemIds = items.map((i) => String(i._id));

  if (items.length === 0) {
    return { success: true, cartItemIds, externalOrderIds: [] };
  }

  const supplier = items[0].supplier as AutosputnikAlias;

  try {
    // ── 1. Очистка корзины ──────────────────────────────────────────────
    userLogger.info(`[AutosputnikCheckout] Очистка корзины (${supplier})`, {
      itemCount: items.length,
    });

    const clearResult = await authedPost<AutosputnikBasketResponse>(
      '/basket/clear',
      supplier,
    );

    const clearErr = normalizeAutosputnikError(clearResult.error);
    if (clearErr) {
      return {
        success: false,
        cartItemIds,
        error: `Ошибка очистки корзины: ${clearErr}`,
      };
    }

    // ── 2. Добавление позиций ───────────────────────────────────────────
    const failedItems: { cartItemId: string; article: string; reason: string }[] = [];
    let latestBasket: AutosputnikBasketProduct[] = [];

    for (const item of items) {
      const fields = extractAutosputnikFields(item, supplier);
      const cartItemId = String(item._id);

      if (!fields) {
        userLogger.warn(
          '[AutosputnikCheckout] Пропущена позиция — отсутствуют обязательные поля в rawItemData',
          { cartItemId, article: item.article },
        );
        failedItems.push({
          cartItemId,
          article: item.article,
          reason: 'missing-fields',
        });
        continue;
      }

      try {
        const payload: AutosputnikBasketAddPayload = {
          articul: fields.articul,
          brandid: fields.brandid,
          quantity: item.quantity,
          price: fields.price,
          id_shop_prices: fields.id_shop_prices,
        };

        userLogger.info('[Autosputnik] POST /basket/add — тело запроса (аудит)', {
          cartItemId,
          article: item.article,
          payloadJson: JSON.stringify(payload),
        });

        const addResult = await authedPost<AutosputnikBasketResponse>(
          '/basket/add',
          supplier,
          payload,
        );

        userLogger.info('[Autosputnik] POST /basket/add — сырой JSON ответа (аудит)', {
          cartItemId,
          article: item.article,
          responseJson: JSON.stringify(addResult),
        });

        const addErr = normalizeAutosputnikError(addResult.error);
        const basketDataOk = Array.isArray(addResult.data);
        if (addErr || !basketDataOk) {
          const reason = addErr ?? 'Некорректное тело ответа (ожидался массив data)';
          failedItems.push({
            cartItemId,
            article: item.article,
            reason,
          });
          userLogger.warn('[AutosputnikCheckout] Позиция не добавлена в корзину', {
            cartItemId,
            article: item.article,
            error: reason,
          });
        } else {
          latestBasket = addResult.data;
          userLogger.info('[AutosputnikCheckout] Позиция добавлена в корзину', {
            cartItemId,
            article: item.article,
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        failedItems.push({ cartItemId, article: item.article, reason: msg });
        userLogger.error('[AutosputnikCheckout] Исключение при добавлении позиции', {
          cartItemId,
          article: item.article,
          error: msg,
        });
      }
    }

    if (latestBasket.length === 0 && failedItems.length > 0) {
      const failSummary = failedItems
        .map((f) => `${f.article}: ${f.reason}`)
        .join('; ');
      return {
        success: false,
        cartItemIds,
        error: `Все позиции отклонены: ${failSummary}`,
      };
    }

    const failNote =
      failedItems.length > 0
        ? `Не добавлены: ${failedItems.map((f) => `${f.article}(${f.reason})`).join(', ')}`
        : undefined;

    const realOrdersEnabled = process.env.AUTOSPUTNIK_ENABLE_REAL_ORDERS === 'true';

    // ── 3. Safety lock: без явного флага заказ у поставщика не создаём ─────
    if (!realOrdersEnabled) {
      userLogger.warn(
        '[Autosputnik] Safety lock active. Items added to basket, but final order was NOT placed.',
        {
          supplier,
          addedCount: latestBasket.length,
          failedCount: failedItems.length,
        },
      );
      return {
        success: true,
        cartItemIds,
        externalOrderIds: [],
        note: 'Safety lock active. Order is in vendor basket.',
        ...(failNote && { error: failNote }),
      };
    }

    // ── 4. POST /order/create — финальное оформление ─────────────────────
    const createBody = buildCreateOrderPayload();
    userLogger.info('[Autosputnik] POST /order/create — тело запроса (аудит)', {
      supplier,
      payloadJson: JSON.stringify(createBody),
    });

    const createRaw = await authedPost<AutosputnikOrderCreateResponse>(
      '/order/create',
      supplier,
      createBody,
    );

    userLogger.info('[Autosputnik] POST /order/create — сырой JSON ответа (аудит)', {
      supplier,
      responseJson: JSON.stringify(createRaw),
    });

    const parsedCreate = parseOrderCreateResult(createRaw);
    if (!parsedCreate.ok) {
      return {
        success: false,
        cartItemIds,
        error: parsedCreate.vendorMessage,
        ...(failNote && { note: failNote }),
      };
    }

    return {
      success: true,
      cartItemIds,
      externalOrderIds: parsedCreate.orderIds,
      ...(failNote && { error: failNote }),
    };
  } catch (error: unknown) {
    const message =
      error instanceof AxiosError
        ? `Autosputnik request failed: ${error.message}`
        : `Autosputnik unexpected error: ${String(error)}`;

    userLogger.error('[AutosputnikCheckout] Исключение при checkout', {
      error: message,
    });

    return { success: false, cartItemIds, error: message };
  }
};

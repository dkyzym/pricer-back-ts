import axios from 'axios';
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

/** Значение comment по умолчанию; позже может заменяться текстом с фронтенда при checkout. */
const AUTOSPUTNIK_DEFAULT_ORDER_COMMENT = 'Заказ через API';

/** Тело POST /order/create: по API поле comment обязательно. */
type AutosputnikCreateOrderBody = {
  comment: string;
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
 * Извлекает тело ответа API при ошибке Axios (4xx/5xx), чтобы видеть валидацию и прочие детали сервера.
 * Без response.data — fallback на message исключения.
 */
const formatAutosputnikHttpErrorDetails = (err: unknown): string => {
  if (axios.isAxiosError(err) && err.response?.data != null) {
    const d = err.response.data;
    if (typeof d === 'string') return d;
    try {
      return JSON.stringify(d);
    } catch {
      return String(d);
    }
  }
  if (err instanceof Error) return err.message;
  return String(err);
};

/** Тело POST /order/create: { comment } — пока фиксированный дефолт, без .env. */
const buildCreateOrderPayload = (): AutosputnikCreateOrderBody => ({
  comment: AUTOSPUTNIK_DEFAULT_ORDER_COMMENT,
});

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
 *  2. POST /basket/add для каждой позиции — атомарно «всё или ничего»: при любой ошибке
 *     добавления сразу после цикла POST /basket/clear и выход без order/create и без safety lock.
 *  3. Если AUTOSPUTNIK_ENABLE_REAL_ORDERS !== 'true' — стоп: корзина у поставщика заполнена,
 *     POST /order/create не вызывается (safety lock).
 *  4. Иначе POST /order/create — тело { comment } (дефолт в коде; позже — с фронтенда);
 *     проверка поля error и id в data.
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
        const errorDetails = formatAutosputnikHttpErrorDetails(err);
        failedItems.push({
          cartItemId,
          article: item.article,
          reason: errorDetails,
        });
        userLogger.error('[AutosputnikCheckout] Исключение при POST /basket/add', {
          cartItemId,
          article: item.article,
          apiError: errorDetails,
          status: axios.isAxiosError(err) ? err.response?.status : undefined,
        });
      }
    }

    // ── Атомарность: частичная корзина недопустима — сброс и выход без order/create ──
    if (failedItems.length > 0) {
      userLogger.warn(
        '[AutosputnikCheckout] Транзакция прервана — очистка частично собранной корзины',
        {
          supplier,
          failedCount: failedItems.length,
          failures: failedItems.map((f) => ({
            cartItemId: f.cartItemId,
            article: f.article,
            reason: f.reason,
          })),
        },
      );
      try {
        const emergencyClear = await authedPost<AutosputnikBasketResponse>(
          '/basket/clear',
          supplier,
        );
        const ecErr = normalizeAutosputnikError(emergencyClear.error);
        if (ecErr) {
          userLogger.error('[AutosputnikCheckout] emergency POST /basket/clear — ошибка API', {
            supplier,
            error: ecErr,
          });
        }
      } catch (emergencyErr: unknown) {
        const msg =
          emergencyErr instanceof Error ? emergencyErr.message : String(emergencyErr);
        userLogger.error('[AutosputnikCheckout] emergency POST /basket/clear — исключение', {
          supplier,
          error: msg,
        });
      }
      return {
        success: false,
        cartItemIds,
        error:
          'Транзакция прервана. Не удалось добавить некоторые позиции. Корзина очищена.',
      };
    }

    const realOrdersEnabled = process.env.AUTOSPUTNIK_ENABLE_REAL_ORDERS === 'true';

    // ── 3. Safety lock: без явного флага заказ у поставщика не создаём ─────
    if (!realOrdersEnabled) {
      userLogger.warn(
        '[Autosputnik] Safety lock active. Items added to basket, but final order was NOT placed.',
        {
          supplier,
          addedCount: latestBasket.length,
        },
      );
      return {
        success: true,
        cartItemIds,
        externalOrderIds: [],
        note: 'Safety lock active. Order is in vendor basket.',
      };
    }

    // ── 4. POST /order/create — финальное оформление ─────────────────────
    const createBody = buildCreateOrderPayload();
    userLogger.info('[Autosputnik] POST /order/create — тело запроса (аудит)', {
      supplier,
      payloadJson: JSON.stringify(createBody),
    });

    let createRaw: AutosputnikOrderCreateResponse;
    try {
      createRaw = await authedPost<AutosputnikOrderCreateResponse>(
        '/order/create',
        supplier,
        createBody,
      );
    } catch (err: unknown) {
      const errorDetails = formatAutosputnikHttpErrorDetails(err);
      userLogger.error('[AutosputnikCheckout] Исключение при POST /order/create', {
        supplier,
        apiError: errorDetails,
        status: axios.isAxiosError(err) ? err.response?.status : undefined,
      });
      return {
        success: false,
        cartItemIds,
        error: `POST /order/create: ${errorDetails}`,
      };
    }

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
      };
    }

    return {
      success: true,
      cartItemIds,
      externalOrderIds: parsedCreate.orderIds,
    };
  } catch (error: unknown) {
    const errorDetails = formatAutosputnikHttpErrorDetails(error);
    const message = axios.isAxiosError(error)
      ? `Autosputnik request failed: ${errorDetails}`
      : `Autosputnik unexpected error: ${errorDetails}`;

    userLogger.error('[AutosputnikCheckout] Исключение при checkout', {
      apiError: errorDetails,
      status: axios.isAxiosError(error) ? error.response?.status : undefined,
    });

    return { success: false, cartItemIds, error: message };
  }
};

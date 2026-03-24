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
}

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
 *     price извлекаются из rawItemData[supplier].
 *  3. Финальный endpoint оформления заказа не документирован —
 *     позиции остаются в корзине для ручного подтверждения.
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

    if (clearResult.error) {
      return {
        success: false,
        cartItemIds,
        error: `Ошибка очистки корзины: ${clearResult.error}`,
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

        const addResult = await authedPost<AutosputnikBasketResponse>(
          '/basket/add',
          supplier,
          payload,
        );

        if (addResult.error) {
          failedItems.push({
            cartItemId,
            article: item.article,
            reason: addResult.error,
          });
          userLogger.warn('[AutosputnikCheckout] Позиция не добавлена в корзину', {
            cartItemId,
            article: item.article,
            error: addResult.error,
          });
        } else {
          latestBasket = addResult.data ?? [];
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

    // ── 3. Финальный endpoint оформления заказа не документирован ────────
    const basketIds = latestBasket.map((bp) => String(bp.id));

    userLogger.warn(
      '[AutosputnikCheckout] Позиции добавлены в корзину, но финальный API оформления заказа ' +
        'не документирован. Требуется ручное подтверждение.',
      {
        supplier,
        addedCount: latestBasket.length,
        failedCount: failedItems.length,
        basketIds,
      },
    );

    const failNote =
      failedItems.length > 0
        ? `Не добавлены: ${failedItems.map((f) => `${f.article}(${f.reason})`).join(', ')}`
        : undefined;

    return {
      success: true,
      cartItemIds,
      externalOrderIds: basketIds,
      note:
        'Autosputnik: позиции добавлены в корзину, финальное оформление не выполнено (API не документирован)',
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

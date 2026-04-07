import axios, { AxiosError } from 'axios';
import https from 'https';
import { Logger } from 'winston';
import { ICartItemDocument } from '../../../models/CartItem.js';
import { CheckoutHandler, CheckoutResult } from '../../orchestration/cart/cart.types.js';
import { SearchResultsParsed } from '../../../types/search.types.js';

// ─────────────────────────────────────────────────────────────────────────────
//  Типы ответов Profit API (cart/add, cart/order)
// ─────────────────────────────────────────────────────────────────────────────

interface ProfitCartAddResponse {
  status: 'success' | 'no-quantity' | 'less' | 'error';
  total: number;
  count: number;
}

interface ProfitOrderResponse {
  status: 'success' | 'error';
  orders?: string[];
  err?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Результат добавления одной позиции (внутренний)
// ─────────────────────────────────────────────────────────────────────────────

interface CartAddItemResult {
  cartItemId: string;
  article: string;
  success: boolean;
  profitStatus: string;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Извлечение полей из rawItemData для Profit cart/add
// ─────────────────────────────────────────────────────────────────────────────

interface ProfitRawFields {
  id?: string;
  warehouse?: string;
  code?: string;
}

/**
 * rawItemData хранит SearchResultsParsed, где:
 *   innerId       → id товара (поле `id` в Profit /cart/add)
 *   warehouse_id  → warehouse (ID склада)
 *   inner_product_code → code (product_code для 1С)
 *
 * Обрабатываем как вложенный `{ profit: { ... } }`, так и плоский формат.
 */
const extractProfitFields = (rawItemData: unknown): ProfitRawFields => {
  const raw = rawItemData as Record<string, unknown> | undefined;
  if (!raw) return {};

  const nested = raw.profit as Partial<SearchResultsParsed> | undefined;
  const source: Partial<SearchResultsParsed> = nested ?? (raw as Partial<SearchResultsParsed>);

  return {
    id: source.innerId != null ? String(source.innerId) : undefined,
    warehouse: source.warehouse_id != null ? String(source.warehouse_id) : undefined,
    code: source.inner_product_code != null ? String(source.inner_product_code) : undefined,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
//  HTTP-инфраструктура
// ─────────────────────────────────────────────────────────────────────────────

const PROFIT_API_BASE = 'https://api.pr-lg.ru';

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

/** Статусы cart/add, означающие отказ на стороне Profit. */
const FAILED_CART_STATUSES = new Set(['no-quantity', 'less', 'error']);

// ─────────────────────────────────────────────────────────────────────────────
//  Шаги checkout: добавление в корзину → оформление заказа
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Добавляет одну позицию в корзину Profit (POST /cart/add).
 * Не бросает исключение при бизнес-ошибках API (no-quantity, less) —
 * оборачивает результат в CartAddItemResult для агрегации.
 */
const addItemToCart = async (
  item: ICartItemDocument,
  apiKey: string,
  userLogger: Logger,
): Promise<CartAddItemResult> => {
  const cartItemId = String(item._id);
  const { id, warehouse, code } = extractProfitFields(item.rawItemData);

  if (!id || !warehouse || !code) {
    userLogger.warn('[ProfitCheckout] Пропущена позиция — отсутствуют обязательные поля rawItemData', {
      cartItemId,
      extracted: { id, warehouse, code },
    });
    return { cartItemId, article: item.article, success: false, profitStatus: 'missing-fields' };
  }

  const payload = new URLSearchParams({
    secret: apiKey,
    id,
    warehouse,
    quantity: String(item.quantity),
    code,
  });

  const { data } = await axios.post<ProfitCartAddResponse>(
    `${PROFIT_API_BASE}/cart/add`,
    payload.toString(),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      httpsAgent,
      timeout: 15_000,
    },
  );

  const ok = !FAILED_CART_STATUSES.has(data.status);

  if (!ok) {
    userLogger.warn('[ProfitCheckout] Позиция не добавлена в корзину Profit', {
      cartItemId,
      article: item.article,
      profitStatus: data.status,
    });
  }

  return { cartItemId, article: item.article, success: ok, profitStatus: data.status };
};

/**
 * Оформляет заказ из текущей корзины Profit (POST /cart/order).
 * method и payment берутся из env-переменных с fallback на '1'.
 */
const placeOrder = async (
  apiKey: string,
  userLogger: Logger,
): Promise<ProfitOrderResponse> => {
  const method = process.env.PROFIT_DELIVERY_METHOD ?? '1';
  const payment = process.env.PROFIT_PAYMENT_METHOD ?? '1';

  const payload = new URLSearchParams({
    secret: apiKey,
    method,
    payment,
  });

  userLogger.info('[ProfitCheckout] Оформление заказа (cart/order)', { method, payment });

  const { data } = await axios.post<ProfitOrderResponse>(
    `${PROFIT_API_BASE}/cart/order`,
    payload.toString(),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      httpsAgent,
      timeout: 30_000,
    },
  );

  return data;
};

// ─────────────────────────────────────────────────────────────────────────────
//  Экспортируемый CheckoutHandler
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Адаптер оформления заказа Profit.
 *
 * Поток данных:
 *  1. Последовательное добавление позиций в корзину через POST /cart/add.
 *     Из rawItemData: innerId → id, warehouse_id → warehouse, inner_product_code → code.
 *  2. Позиции со статусом `no-quantity`, `less`, `error` — неуспешны (но не прерывают поток).
 *  3. Safety lock (PROFIT_ENABLE_REAL_ORDERS): если не 'true' — dry-run без /cart/order.
 *  4. POST /cart/order — фактическое оформление. method/payment из env с fallback.
 *
 * У Profit нет endpoint-а очистки всей корзины — предполагается пустая корзина
 * или индифферентность к ранее добавленным позициям.
 */
export const profitCheckoutHandler: CheckoutHandler = async (
  items: ICartItemDocument[],
  userLogger: Logger,
  _options?,
): Promise<CheckoutResult> => {
  const cartItemIds = items.map((i) => String(i._id));

  if (items.length === 0) {
    return { success: true, cartItemIds, externalOrderIds: [] };
  }

  const apiKey = process.env.PROFIT_API_KEY;
  if (!apiKey) {
    userLogger.error('[ProfitCheckout] Отсутствует PROFIT_API_KEY');
    return { success: false, cartItemIds, error: 'PROFIT_API_KEY не задан' };
  }

  try {
    // ── 1. Добавление позиций в корзину ─────────────────────────────────
    userLogger.info('[ProfitCheckout] Добавление позиций в корзину Profit', {
      itemCount: items.length,
      articles: items.map((i) => i.article),
    });

    const addResults: CartAddItemResult[] = [];

    for (const item of items) {
      try {
        const result = await addItemToCart(item, apiKey, userLogger);
        addResults.push(result);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        userLogger.error('[ProfitCheckout] Исключение при добавлении позиции', {
          cartItemId: String(item._id),
          article: item.article,
          error: msg,
        });
        addResults.push({
          cartItemId: String(item._id),
          article: item.article,
          success: false,
          profitStatus: 'exception',
        });
      }
    }

    const succeeded = addResults.filter((r) => r.success);
    const failed = addResults.filter((r) => !r.success);

    if (succeeded.length === 0) {
      const failSummary = failed
        .map((f) => `${f.article}: ${f.profitStatus}`)
        .join('; ');
      return { success: false, cartItemIds, error: `Все позиции отклонены: ${failSummary}` };
    }

    if (failed.length > 0) {
      userLogger.warn('[ProfitCheckout] Часть позиций не добавлена в корзину', {
        failed: failed.map((f) => ({ id: f.cartItemId, article: f.article, status: f.profitStatus })),
      });
    }

    // ── 2. Safety lock ──────────────────────────────────────────────────
    if (process.env.PROFIT_ENABLE_REAL_ORDERS !== 'true') {
      userLogger.warn(
        '[ProfitCheckout] Оформление заказа пропущено — safety lock активен' +
          ' (PROFIT_ENABLE_REAL_ORDERS !== "true")',
        { addedCount: succeeded.length, totalItems: items.length },
      );
      return {
        success: true,
        cartItemIds,
        note: `Dry-run: ${succeeded.length}/${items.length} позиций добавлено в корзину, заказ не оформлен`,
      };
    }

    // ── 3. Оформление заказа ────────────────────────────────────────────
    const orderResult = await placeOrder(apiKey, userLogger);

    if (orderResult.status === 'error' || !orderResult.orders?.length) {
      return {
        success: false,
        cartItemIds,
        error: `Profit cart/order: ${orderResult.err ?? 'неизвестная ошибка'}`,
      };
    }

    userLogger.info('[ProfitCheckout] Заказ оформлен', {
      externalOrderIds: orderResult.orders,
      failedItems: failed.length,
    });

    const failNote = failed.length > 0
      ? `Не добавлены: ${failed.map((f) => `${f.article}(${f.profitStatus})`).join(', ')}`
      : undefined;

    return {
      success: true,
      cartItemIds,
      externalOrderIds: orderResult.orders,
      ...(failNote && { error: failNote }),
    };
  } catch (error: unknown) {
    const message =
      error instanceof AxiosError
        ? `Profit request failed: ${error.message}`
        : `Profit unexpected error: ${String(error)}`;

    userLogger.error('[ProfitCheckout] Исключение при checkout', { error: message });

    return { success: false, cartItemIds, error: message };
  }
};

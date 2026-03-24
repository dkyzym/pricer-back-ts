import { AxiosError, AxiosInstance } from 'axios';
import { Logger } from 'winston';
import { ICartItemDocument } from '../../../models/CartItem.js';
import { getAxiosInstance } from '../../../infrastructure/http/apiClient.js';
import { CheckoutHandler, CheckoutResult } from '../../orchestration/cart/cart.types.js';
import { SupplierName } from '../../../types/common.types.js';
import { AbcpArticleSearchResult } from './abcpPlatform.types.js';

// ─────────────────────────────────────────────────────────────────────────────
//  Типы ответов ABCP (basket/clear, basket/add, basket/order)
// ─────────────────────────────────────────────────────────────────────────────

interface AbcpBasketClearResponse {
  status: 0 | 1;
  errorMessage?: string;
}

interface AbcpBasketAddPositionResult {
  brand: string;
  number: string;
  supplierCode: string;
  quantity: number;
  status: 0 | 1;
  errorMessage?: string;
}

interface AbcpBasketAddResponse {
  status: 0 | 1;
  positions: AbcpBasketAddPositionResult[];
}

interface AbcpOrderRaw {
  number: string;
  positions?: unknown[];
}

interface AbcpOrderResult {
  status: 0 | 1;
  errorMessage?: string;
  orders?: AbcpOrderRaw[];
}

// ─────────────────────────────────────────────────────────────────────────────
//  Извлечение itemKey / supplierCode из rawItemData
// ─────────────────────────────────────────────────────────────────────────────

interface AbcpRawFields {
  itemKey?: string;
  supplierCode?: string;
}

/**
 * rawItemData может храниться как вложенный объект `{ [supplierAlias]: { itemKey, supplierCode, ... } }`
 * или как плоский объект на корневом уровне — обрабатываем оба варианта.
 */
const extractAbcpFields = (
  rawItemData: unknown,
  supplierAlias: string,
): AbcpRawFields => {
  const raw = rawItemData as Record<string, unknown> | undefined;
  if (!raw) return {};

  const nested = raw[supplierAlias] as Partial<AbcpArticleSearchResult> | undefined;
  if (nested?.itemKey != null) {
    return {
      itemKey: String(nested.itemKey),
      supplierCode: String(nested.supplierCode ?? ''),
    };
  }

  return {
    itemKey: raw.itemKey != null ? String(raw.itemKey) : undefined,
    supplierCode: raw.supplierCode != null ? String(raw.supplierCode) : undefined,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
//  Формирование URLSearchParams для basket/add (пакетный формат)
// ─────────────────────────────────────────────────────────────────────────────

interface AbcpPosition {
  number: string;
  brand: string;
  supplierCode: string;
  itemKey: string;
  quantity: number;
}

const buildBasketAddParams = (positions: AbcpPosition[]): string => {
  const params = new URLSearchParams();
  positions.forEach((pos, i) => {
    const prefix = `positions[${i}]`;
    params.append(`${prefix}[number]`, pos.number);
    params.append(`${prefix}[brand]`, pos.brand);
    params.append(`${prefix}[supplierCode]`, pos.supplierCode);
    params.append(`${prefix}[itemKey]`, pos.itemKey);
    params.append(`${prefix}[quantity]`, String(pos.quantity));
  });
  return params.toString();
};

// ─────────────────────────────────────────────────────────────────────────────
//  Шаги checkout: clear → add → order
// ─────────────────────────────────────────────────────────────────────────────

const clearBasket = async (
  axiosInstance: AxiosInstance,
  userLogger: Logger,
  supplierAlias: string,
): Promise<void> => {
  const { data } = await axiosInstance.post<AbcpBasketClearResponse>(
    '/basket/clear',
    '',
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
  );

  if (data.status === 0) {
    userLogger.warn(`[AbcpCheckout:${supplierAlias}] basket/clear вернул status 0`, {
      errorMessage: data.errorMessage,
    });
  }
};

const addPositionsToBasket = async (
  axiosInstance: AxiosInstance,
  positions: AbcpPosition[],
  userLogger: Logger,
  supplierAlias: string,
): Promise<AbcpBasketAddResponse> => {
  const body = buildBasketAddParams(positions);

  const { data } = await axiosInstance.post<AbcpBasketAddResponse>(
    '/basket/add',
    body,
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
  );

  if (data.status === 0) {
    const failed = (data.positions ?? [])
      .filter((p) => p.status === 0)
      .map((p) => `${p.number}/${p.brand}: ${p.errorMessage ?? '?'}`)
      .join('; ');
    userLogger.warn(`[AbcpCheckout:${supplierAlias}] basket/add — часть позиций не добавлена`, {
      failed,
    });
  }

  return data;
};

const placeOrder = async (
  axiosInstance: AxiosInstance,
  userLogger: Logger,
  supplierAlias: string,
): Promise<AbcpOrderResult> => {
  const orderParams = new URLSearchParams();
  orderParams.set('paymentMethod', process.env.ABCP_PAYMENT_METHOD ?? '0');
  orderParams.set('shipmentAddress', process.env.ABCP_SHIPMENT_ADDRESS ?? '0');

  const { data } = await axiosInstance.post<AbcpOrderResult>(
    '/basket/order',
    orderParams.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
  );

  if (data.status === 0) {
    userLogger.error(`[AbcpCheckout:${supplierAlias}] basket/order ошибка`, {
      errorMessage: data.errorMessage,
    });
  }

  return data;
};

// ─────────────────────────────────────────────────────────────────────────────
//  Фабрика CheckoutHandler для ABCP-площадок
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Паттерн «Factory» — создаёт CheckoutHandler для конкретной ABCP-площадки.
 *
 * Поток данных:
 *  1. POST /basket/clear — очистка корзины поставщика.
 *  2. Маппинг ICartItemDocument[] → positions[] и пакетный POST /basket/add.
 *  3. Проверка safety lock (ABCP_ENABLE_REAL_ORDERS).
 *     - false  → dry-run: возвращаем success без оформления.
 *     - true   → POST /basket/order, возвращаем externalOrderIds.
 *
 * Safety lock гарантирует, что реальные заказы не создаются случайно в dev/staging.
 */
export const createAbcpCheckoutHandler = (supplierAlias: string): CheckoutHandler =>
  async (items: ICartItemDocument[], userLogger: Logger): Promise<CheckoutResult> => {
    const cartItemIds = items.map((i) => String(i._id));

    if (items.length === 0) {
      return { success: true, cartItemIds, externalOrderIds: [] };
    }

    const axiosInstance = await getAxiosInstance(supplierAlias as SupplierName);

    // ── Маппинг позиций ─────────────────────────────────────────────────
    const positions: AbcpPosition[] = [];
    const skippedIds: string[] = [];

    for (const item of items) {
      const { itemKey, supplierCode } = extractAbcpFields(item.rawItemData, supplierAlias);

      if (!itemKey || !supplierCode) {
        skippedIds.push(String(item._id));
        continue;
      }

      positions.push({
        number: item.article,
        brand: item.brand,
        supplierCode,
        itemKey,
        quantity: item.quantity,
      });
    }

    if (positions.length === 0) {
      userLogger.error(
        `[AbcpCheckout:${supplierAlias}] Не удалось собрать позиции — itemKey/supplierCode отсутствуют`,
        { skippedIds },
      );
      return { success: false, cartItemIds, error: 'Нет позиций с itemKey/supplierCode для ABCP' };
    }

    if (skippedIds.length > 0) {
      userLogger.warn(
        `[AbcpCheckout:${supplierAlias}] Пропущены позиции без itemKey/supplierCode`,
        { skippedIds },
      );
    }

    try {
      // ── 1. Очистка корзины ──────────────────────────────────────────────
      userLogger.info(`[AbcpCheckout:${supplierAlias}] Очистка корзины`, {
        itemCount: positions.length,
      });
      await clearBasket(axiosInstance, userLogger, supplierAlias);

      // ── 2. Добавление позиций ───────────────────────────────────────────
      userLogger.info(`[AbcpCheckout:${supplierAlias}] Добавление позиций в корзину`, {
        articles: positions.map((p) => p.number),
      });
      const addResult = await addPositionsToBasket(axiosInstance, positions, userLogger, supplierAlias);

      const addedCount = (addResult.positions ?? []).filter((p) => p.status === 1).length;
      if (addedCount === 0) {
        return { success: false, cartItemIds, error: 'ABCP: ни одна позиция не была добавлена в корзину' };
      }

      // ── 3. Safety lock ──────────────────────────────────────────────────
      if (process.env.ABCP_ENABLE_REAL_ORDERS !== 'true') {
        userLogger.warn(
          `[AbcpCheckout:${supplierAlias}] ABCP checkout skipped due to safety lock` +
            ' (ABCP_ENABLE_REAL_ORDERS !== "true")',
          { addedCount, totalPositions: positions.length },
        );
        return { success: true, cartItemIds };
      }

      // ── 4. Оформление заказа ────────────────────────────────────────────
      userLogger.info(`[AbcpCheckout:${supplierAlias}] Оформление заказа (basket/order)`);
      const orderResult = await placeOrder(axiosInstance, userLogger, supplierAlias);

      if (orderResult.status === 0 && !orderResult.orders?.length) {
        return {
          success: false,
          cartItemIds,
          error: `ABCP basket/order: ${orderResult.errorMessage ?? 'неизвестная ошибка'}`,
        };
      }

      const externalOrderIds = (orderResult.orders ?? []).map((o) => o.number);

      userLogger.info(`[AbcpCheckout:${supplierAlias}] Заказ оформлен`, { externalOrderIds });

      return { success: true, cartItemIds, externalOrderIds };
    } catch (error: unknown) {
      const message =
        error instanceof AxiosError
          ? `ABCP ${supplierAlias} request failed: ${error.message}`
          : `ABCP ${supplierAlias} unexpected error: ${String(error)}`;

      userLogger.error(`[AbcpCheckout:${supplierAlias}] Исключение при checkout`, {
        error: message,
      });

      return { success: false, cartItemIds, error: message };
    }
  };

import { Logger } from 'winston';
import { abcpHeaders } from '../../../../constants/headers.js';
import type { ICartItemDocument } from '../../../../models/CartItem.js';
import type {
  ActualizeReportItem,
  ActualizeStatus,
} from '../../../cart/actualizeCartItems.js';
import {
  computeActualizePriceDirection,
  computeActualizeStockStatus,
  resolvePriceComparisonBaseline,
} from '../../../cart/actualizeCartReportUtils.js';
import type { UnifiedCartRequest } from '../../../orchestration/cart/cart.types.js';
import { cartSupplierHandlers } from '../../../orchestration/cart/cartHandlers.js';
import { cleanArticleString } from '../../../../utils/data/brand/cleanArticleString.js';
import { parseAvailability } from '../../../../utils/parseAvailability.js';
import { yieldToEventLoop } from '../../../../utils/yieldToEventLoop.js';
import { clearAbcpCartHtml } from './clearAbcpCartHtml.js';
import { resolveHtmlClient } from './clientRegistry.js';
import { getAbcpStrategy } from './strategies/StrategyFactory.js';
import type { CartPosition } from './strategies/abcpStrategy.types.js';

const buildErrorReport = (
  cartItem: ICartItemDocument,
  error: string,
): ActualizeReportItem => ({
  cartItemId: cartItem._id.toString(),
  article: cartItem.article,
  brand: cartItem.brand,
  supplier: cartItem.supplier,
  name: cartItem.name,
  status: 'error',
  initialPrice: cartItem.initialPrice,
  currentPrice: null,
  priceDiff: null,
  availableQuantity: null,
  requestedQuantity: cartItem.quantity,
  isAvailable: false,
  priceDirection: null,
  stockStatus: 'unknown',
  error,
});

const findPositionByNormalizedArticle = (
  positions: CartPosition[],
  normalizedArticle: string,
): CartPosition | undefined => {
  for (const p of positions) {
    if (cleanArticleString(p.article) === normalizedArticle) {
      return p;
    }
  }
  return undefined;
};

/** Собирает UnifiedCartRequest из сохранённого CartItem (rawItemData + поля документа). */
const buildUnifiedCartRequestFromDocument = (
  supplierName: string,
  cartItem: ICartItemDocument,
): UnifiedCartRequest => {
  const raw = cartItem.rawItemData;
  const spread =
    raw !== null && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  return {
    supplier: supplierName,
    quantity: cartItem.quantity,
    item: {
      ...spread,
      brand: cartItem.brand,
      article: cartItem.article,
      name: cartItem.name,
    },
  };
};

/**
 * Stateful-актуализация ABCP: очистка удалённой корзины → добавление позиций через тот же хендлер,
 * что и при обычном add-to-cart → GET `/cart` → разбор стратегией → сопоставление по нормализованному артикулу
 * → в `finally` снова очистка, чтобы не оставлять товары у поставщика.
 */
export const actualizeAbcpCart = async (
  supplierName: string,
  expectedItems: ICartItemDocument[],
  userLogger: Logger,
): Promise<ActualizeReportItem[]> => {
  if (expectedItems.length === 0) {
    return [];
  }

  await clearAbcpCartHtml(supplierName);

  let reports: ActualizeReportItem[] = [];

  try {
    const addToCart = cartSupplierHandlers[supplierName];

    if (!addToCart) {
      reports = expectedItems.map((item) =>
        buildErrorReport(
          item,
          `Обработчик добавления в корзину для поставщика «${supplierName}» не найден.`,
        ),
      );
      return reports;
    }

    for (const cartItem of expectedItems) {
      try {
        const unified = buildUnifiedCartRequestFromDocument(
          supplierName,
          cartItem,
        );
        const addResult = await addToCart(unified);
        if (!addResult.success) {
          userLogger.warn(
            `[Actualize ABCP] Не удалось добавить в корзину поставщика: ${cartItem.article} (${cartItem.brand}) — ${addResult.message}`,
          );
        }
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : 'Неизвестная ошибка при добавлении в корзину ABCP.';
        userLogger.error(
          `[Actualize ABCP] Ошибка addToCart: ${cartItem.article} (${cartItem.brand}) — ${msg}`,
        );
      }
    }

    const client = resolveHtmlClient(supplierName);
    const { baseUrl } = client.config;
    const strategy = getAbcpStrategy(supplierName);

    const cartUrl = `${baseUrl}/cart`;
    const cartRes = await client.makeRequest(cartUrl, { headers: abcpHeaders });
    const cartHtml = String(cartRes.data ?? '');

    await yieldToEventLoop();

    const parsedPositions = strategy.extractPositions(cartHtml);

    const built: ActualizeReportItem[] = [];

    for (const cartItem of expectedItems) {
      const itemId = cartItem._id.toString();
      const normalizedExpected = cleanArticleString(cartItem.article);
      const pos = findPositionByNormalizedArticle(
        parsedPositions,
        normalizedExpected,
      );

      if (!pos) {
        built.push({
          cartItemId: itemId,
          article: cartItem.article,
          brand: cartItem.brand,
          supplier: cartItem.supplier,
          name: cartItem.name,
          status: 'not_found',
          initialPrice: cartItem.initialPrice,
          currentPrice: null,
          priceDiff: null,
          availableQuantity: null,
          requestedQuantity: cartItem.quantity,
          isAvailable: false,
          priceDirection: null,
          stockStatus: 'unknown',
        });
        continue;
      }

      const baseline = resolvePriceComparisonBaseline(cartItem);
      const newPrice = pos.price;
      const priceDirection = computeActualizePriceDirection(baseline, newPrice);
      const qtyForAvail: number | string = pos.quantity;
      const availNum = parseAvailability(qtyForAvail);
      const stockStatus = computeActualizeStockStatus(availNum, cartItem.quantity);
      const isAvailable = stockStatus === 'sufficient';
      const status: ActualizeStatus =
        priceDirection === 'up' || priceDirection === 'down'
          ? 'price_changed'
          : 'ok';
      const priceDiff =
        baseline !== null ? +(newPrice - baseline).toFixed(2) : null;

      const prev = cartItem.rawItemData;
      const prevRecord =
        prev !== null && typeof prev === 'object' && !Array.isArray(prev)
          ? { ...(prev as Record<string, unknown>) }
          : {};

      cartItem.rawItemData = {
        ...prevRecord,
        innerId: String(pos.id),
        price: pos.price,
        availability: qtyForAvail,
        article: pos.article,
      };
      cartItem.currentPrice = newPrice;

      built.push({
        cartItemId: itemId,
        article: cartItem.article,
        brand: cartItem.brand,
        supplier: cartItem.supplier,
        name: cartItem.name,
        status,
        initialPrice: cartItem.initialPrice,
        currentPrice: newPrice,
        priceDiff,
        availableQuantity: qtyForAvail,
        requestedQuantity: cartItem.quantity,
        isAvailable,
        priceDirection,
        stockStatus,
      });
    }

    reports = built;
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Неизвестная ошибка при запросе корзины ABCP.';
    reports = expectedItems.map((item) => buildErrorReport(item, message));
  } finally {
    await clearAbcpCartHtml(supplierName);
  }

  return reports;
};

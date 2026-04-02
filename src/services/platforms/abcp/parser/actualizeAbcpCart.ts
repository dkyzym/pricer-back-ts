import { abcpHeaders } from '../../../../constants/headers.js';
import type { ICartItemDocument } from '../../../../models/CartItem.js';
import type { ActualizeReportItem } from '../../../cart/actualizeCartItems.js';
import { cleanArticleString } from '../../../../utils/data/brand/cleanArticleString.js';
import { yieldToEventLoop } from '../../../../utils/yieldToEventLoop.js';
import { resolveHtmlClient } from './clientRegistry.js';
import { getAbcpStrategy } from './strategies/StrategyFactory.js';
import type { CartPosition } from './strategies/abcpStrategy.types.js';

/**
 * Парсит `availability` так же, как в actualizeCartItems: число или строка с цифрами.
 */
const parseAvailability = (value: number | string): number | null => {
  if (typeof value === 'number') return value;
  const parsed = parseInt(value, 10);
  if (!isNaN(parsed)) return parsed;
  const digits = value.replace(/\D/g, '');
  return digits ? parseInt(digits, 10) : null;
};

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

/**
 * Актуализация по HTML корзины ABCP (mikano / autoImpulse).
 *
 * Поток: resolveHtmlClient → GET /cart → extractPositions стратегией темы → сопоставление
 * с CartItem по `cleanArticleString(article)` → обновление `currentPrice` и `rawItemData`
 * в переданных документах (сохранение — в вызывающем actualizeCartItems).
 */
export const actualizeAbcpCart = async (
  supplierName: string,
  expectedItems: ICartItemDocument[],
): Promise<ActualizeReportItem[]> => {
  if (expectedItems.length === 0) {
    return [];
  }

  try {
    const client = resolveHtmlClient(supplierName);
    const { baseUrl } = client.config;
    const strategy = getAbcpStrategy(supplierName);

    const cartUrl = `${baseUrl}/cart`;
    const cartRes = await client.makeRequest(cartUrl, { headers: abcpHeaders });
    const cartHtml = String(cartRes.data ?? '');

    await yieldToEventLoop();

    const positions = strategy.extractPositions(cartHtml);

    const reports: ActualizeReportItem[] = [];

    for (const cartItem of expectedItems) {
      const itemId = cartItem._id.toString();
      const normalizedExpected = cleanArticleString(cartItem.article);
      const pos = findPositionByNormalizedArticle(positions, normalizedExpected);

      if (!pos) {
        reports.push({
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
        });
        continue;
      }

      const newPrice = pos.price;
      const priceChanged = newPrice !== cartItem.initialPrice;
      const availNum = parseAvailability(pos.quantity);
      const isAvailable =
        availNum !== null ? availNum >= cartItem.quantity : false;

      const prev = cartItem.rawItemData;
      const prevRecord =
        prev !== null && typeof prev === 'object' && !Array.isArray(prev)
          ? { ...(prev as Record<string, unknown>) }
          : {};

      cartItem.rawItemData = {
        ...prevRecord,
        innerId: String(pos.id),
        price: pos.price,
        availability: pos.quantity,
        article: pos.article,
      };
      cartItem.currentPrice = newPrice;

      reports.push({
        cartItemId: itemId,
        article: cartItem.article,
        brand: cartItem.brand,
        supplier: cartItem.supplier,
        name: cartItem.name,
        status: priceChanged ? 'price_changed' : 'ok',
        initialPrice: cartItem.initialPrice,
        currentPrice: newPrice,
        priceDiff: +(newPrice - cartItem.initialPrice).toFixed(2),
        availableQuantity: pos.quantity,
        requestedQuantity: cartItem.quantity,
        isAvailable,
      });
    }

    return reports;
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Неизвестная ошибка при запросе корзины ABCP.';
    return expectedItems.map((item) => buildErrorReport(item, message));
  }
};

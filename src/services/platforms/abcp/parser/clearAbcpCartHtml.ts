import { logger } from '../../../../config/logger/index.js';
import { abcpHeaders } from '../../../../constants/headers.js';
import { yieldToEventLoop } from '../../../../utils/yieldToEventLoop.js';
import { getAbcpStrategy } from './strategies/StrategyFactory.js';
import { resolveHtmlClient } from './clientRegistry.js';

export type ClearAbcpCartHtmlResult =
  | { success: true; removedCount: number }
  | { success: false; error: string };

const debugAbcpCart = (message: string, meta?: Record<string, unknown>): void => {
  if (process.env.DEBUG_ABCP_CART === 'true') {
    logger.debug(`[ABCP cart] ${message}`, meta ?? {});
  }
};

/**
 * Полная очистка корзины ABCP перед ручным чекаутом: GET /cart, разбор позиций стратегией, очистка по правилам темы.
 *
 * Поток: сессия через тот же HTML-клиент, что и оформление заказа; при пустой корзине — выход без запросов удаления.
 */
export const clearAbcpCartHtml = async (
  supplierName: string,
): Promise<ClearAbcpCartHtmlResult> => {
  const client = resolveHtmlClient(supplierName);
  const { baseUrl } = client.config;

  try {
    const cartUrl = `${baseUrl}/cart`;
    const cartRes = await client.makeRequest(cartUrl, { headers: abcpHeaders });
    const cartHtml = String(cartRes.data ?? '');

    await yieldToEventLoop();

    const strategy = getAbcpStrategy(supplierName);
    const positions = strategy.extractPositions(cartHtml);
    debugAbcpCart('clearAbcpCartHtml', { supplier: supplierName, positionCount: positions.length });
    if (positions.length === 0) {
      return { success: true, removedCount: 0 };
    }

    const removedCount = await strategy.clearCart(client, positions, cartUrl);
    return { success: true, removedCount };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
};

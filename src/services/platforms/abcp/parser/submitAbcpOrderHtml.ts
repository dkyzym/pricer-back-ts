import { logger } from '../../../../config/logger/index.js';
import { abcpHeaders } from '../../../../constants/headers.js';
import { yieldToEventLoop } from '../../../../utils/yieldToEventLoop.js';
import { autoImpulseClient } from '../../../suppliers/autoImpulse/client.js';
import { mikanoClient } from '../../../suppliers/mikano/client.js';
import type { AbcpClient } from './createHtmlClient.js';
import { getAbcpStrategy } from './strategies/StrategyFactory.js';

export type SubmitAbcpOrderResult =
  | { success: true; externalOrderId: string }
  | { success: false; error: string };

export type ClearAbcpCartHtmlResult =
  | { success: true; removedCount: number }
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
  const client = resolveClient(supplierName);
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

/**
 * Финальное оформление заказа на ABCP: GET /cart, разбор HTML стратегией темы, затем submitOrder (AJAX или MAS-форма).
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
  const strategy = getAbcpStrategy(supplierName);

  try {
    const cartUrl = `${baseUrl}/cart`;
    const cartRes = await client.makeRequest(cartUrl, { headers: abcpHeaders });
    const cartHtml = String(cartRes.data ?? '');

    await yieldToEventLoop();

    debugAbcpCart('submit GET /cart', {
      supplier: supplierName,
      htmlLength: cartHtml.length,
    });

    const agreementId = strategy.parseAgreementId(cartHtml);
    if (!agreementId) {
      debugAbcpCart('agreementId не найден (пропускаем)', { supplier: supplierName });
    } else {
      debugAbcpCart('agreementId', { supplier: supplierName, agreementId });
    }

    const positions = strategy.extractPositions(cartHtml);
    if (positions.length === 0) {
      return { success: false, error: 'Корзина пуста или не удалось распарсить позиции на /cart' };
    }

    const result = await strategy.submitOrder(client, positions, agreementId, cartUrl);
    if (result.success && result.externalOrderId) {
      return { success: true, externalOrderId: result.externalOrderId };
    }
    return {
      success: false,
      error:
        result.error ??
        (result.success ? 'Номер заказа не получен' : 'Ошибка оформления заказа'),
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
};

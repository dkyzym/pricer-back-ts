import type { AbcpClient } from '../createHtmlClient.js';

export interface CartPosition {
  id: number;
  quantity: number;
  article: string;
  price: number;
  /** Опционально, если тема требует удаления по конкретному URL */
  deleteUrl?: string;
}

/**
 * Strategy: разные темы ABCP (стандартная сетка vs MAS) требуют разных HTTP-путей оформления заказа.
 */
export interface IAbcpCartStrategy {
  parseAgreementId(html: string): string | null;
  extractPositions(html: string): CartPosition[];
  clearCart(client: AbcpClient, positions: CartPosition[], cartUrl: string): Promise<number>;
  submitOrder(
    client: AbcpClient,
    positions: CartPosition[],
    agreementId: string | null,
    cartUrl: string,
  ): Promise<{ success: boolean; externalOrderId?: string; error?: string }>;
}

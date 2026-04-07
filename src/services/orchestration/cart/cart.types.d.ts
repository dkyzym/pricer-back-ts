import { Logger } from 'winston';
import { ICartItemDocument } from '../../../models/CartItem.js';
import { SupplierName } from '../../../types/common.types.js';

/**
 * Универсальный payload от фронтенда для добавления в корзину.
 * `item` остаётся гибким — это полная сущность товара из таблицы результатов.
 */
export interface UnifiedCartRequest {
  supplier: string;
  quantity: number;
  item: Record<string, any>;
}

export interface AddToCartConfig {
  id: string;
  warehouse: string;
  quantity: number;
  code: string;
  supplier?: SupplierName;
}

/** Параметры для добавления в корзину (унифицированная позиция) */
export interface UnifiedCartPosition {
  number: string;
  brand: string;
  supplierCode: string;
  itemKey: string;
  quantity: number;
}

export interface ABCP_API_CartResponse {
  status: 1 | 0;
  errorMessage?: string;
  positions: Array<{
    number: string;
    brand: string;
    supplierCode: string;
    quantity: string;
    numberFix: string;
    deadline: number;
    deadlineMax: number;
    description: string;
    status: 1 | 0;
    errorMessage?: string;
  }>;
}

export interface AddResultXML {
  AddResult: {
    Message: string;
    ID: string;
    OrderedQTY: string;
    OrderedCode: string;
  };
}

export type CartHandlerResponse = {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
};

export type CartHandler = (
  data: UnifiedCartRequest
) => Promise<CartHandlerResponse>;

export type ProfitAPIresponse = {
  status: 'success' | 'no-quantity' | 'less' | 'error';
  total: number;
  count: number;
};

/**
 * Результат checkout (оформления заказа) для одного поставщика.
 * `externalOrderIds` — идентификаторы заказов, присвоенные на стороне поставщика.
 */
export interface CheckoutResult {
  success: boolean;
  cartItemIds: string[];
  externalOrderIds?: string[];
  error?: string;
  note?: string;
}

/** Форма оплаты Patriot: безнал — PATRIOT_PAYMENT_METHOD_ID_BN, наличные — PATRIOT_PAYMENT_METHOD_ID */
export type PatriotPaymentForm = 'non_cash' | 'cash';

/** Опции чекаута с фронтенда (расширяем по мере необходимости). */
export interface CartCheckoutOptions {
  patriotPaymentForm?: PatriotPaymentForm;
}

/**
 * Контракт адаптера оформления заказа (checkout) у конкретного поставщика.
 * Принимает массив позиций корзины (уже отфильтрованных по поставщику)
 * и логгер запроса для трассировки.
 */
export type CheckoutHandler = (
  items: ICartItemDocument[],
  userLogger: Logger,
  options?: CartCheckoutOptions,
) => Promise<CheckoutResult>;

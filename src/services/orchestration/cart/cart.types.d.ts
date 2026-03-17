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
  status: 'success' | 'no - quantity' | 'less' | 'error';
  total: number;
  count: number;
};

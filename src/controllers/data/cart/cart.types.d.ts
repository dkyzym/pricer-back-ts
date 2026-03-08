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

//** Параметры для добавления в корзину ЮГ */
export interface BasketPositionUG {
  number: string;
  brand: string;
  supplierCode: string;
  itemKey: string;
  quantity: number;
}

export interface UgCartResponse {
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

export type CartHandler = (data: UnifiedCartRequest) => Promise<CartHandlerResponse>;

export type ProfitAPIresponse = { status: "success" | 'no - quantity' | 'less' | 'error', total: number, count: number }

/** Позиция для создания заказа в API TurboCars (POST /order:create) */
export interface TurboCarsOrderCreatePosition {
  provider_id: number;
  price: number;
  code: string;
  brand: string;
  count: number;
  comment?: string;
}

/** Тело запроса POST /order:create */
export interface TurboCarsOrderCreateRequest {
  is_test: 0 | 1;
  positions: TurboCarsOrderCreatePosition[];
}

/** Отклонённая позиция в ответе order:create */
export interface TurboCarsOrderCreateBadOffer {
  code: string;
  brand: string;
  reason: string;
}

/** Ответ API TurboCars на POST /order:create */
export interface TurboCarsOrderCreateResponse {
  order_number: string;
  is_test: 0 | 1;
  bad_offers?: TurboCarsOrderCreateBadOffer[];
}


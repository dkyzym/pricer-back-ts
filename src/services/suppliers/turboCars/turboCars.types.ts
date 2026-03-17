export interface TurboCarsPositionRaw {
  id: number;

  code: string;

  brand: string;

  name: string;

  price: string;

  delivery_date_time_start: string | null;

  delivery_date_time_end: string | null;

  count: number;

  status: string;

  comment?: string | null;

  status_id?: number | null;

  [key: string]: unknown;
}

export interface TurboCarsOrderRaw {
  order_number: string;

  positions: TurboCarsPositionRaw[];

  [key: string]: unknown;
}

export interface TurboCarsOrdersResponse {
  orders_data: TurboCarsOrderRaw[];

  meta?: Record<string, unknown> | null;
}

export interface TurboCarsErrorMessage {
  description: string;
  [key: string]: unknown;
}

export interface TurboCarsErrorResponse {
  error_code: string;
  error_message: TurboCarsErrorMessage;
}

export interface TurboCarsBrandSearchSuccess {
  code: string;
  brands: string[];
}

export type TurboCarsBrandSearchResponse =
  | TurboCarsBrandSearchSuccess
  | TurboCarsErrorResponse;

export interface TurboCarsOfferRaw {
  provider_id: number;
  our_stock: boolean;
  cross: boolean;
  brand: string;
  code: string;
  name: string;
  price: string;
  multiplicity: number;
  currency: string;
  count: number;
  available_more: boolean;
  delivery_date_time_start: string | null;
  delivery_date_time_end: string | null;
  is_returnable: boolean;
  days_for_return: number;
  [key: string]: unknown;
}

export interface TurboCarsOffersSearchSuccess {
  code: string;
  brand: string;
  offers: TurboCarsOfferRaw[];
}

export type TurboCarsOffersSearchResponse =
  | TurboCarsOffersSearchSuccess
  | TurboCarsErrorResponse;

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


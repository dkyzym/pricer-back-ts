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

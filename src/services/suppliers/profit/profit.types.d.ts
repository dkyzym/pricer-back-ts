export interface ItemI {
  article: string;
  brand: string;
}

export type ItemsGroupProfit = ItemI[];

interface ProductProfit {
  donkey: string;
  warehouse_id: string;
  brand_id: number;
  brand: string;
  article: string;
  product_code: string;
  multi: number;
  quantity: string;
  price: number;
  returnable: number;
  description: string;
  article_id: string;
  return_days: number;
  brand_info: boolean;
  brand_warranty: boolean;
  original: boolean;
  waitings: number;
  custom_warehouse_name: string;
  show_date: string;
  delivery_time: number;
  allow_return: string;
  delivery_date: string;
  delivery_probability: number;
  imageUrl?: string;
  supplier?: SupplierName;
}

export interface ApiResponseItem {
  id: string;
  article: string;
  description: string;
  brand: string;
  original: string;
  brand_warranty: string;
  products: {
    [key: string]: ProductProfit;
  };
}

export interface ProfitItem {
  availability: number;
  brand: string;
  description: string;
  number: string;
  numberFix: string;
  article: string;
  original: boolean;
  own: boolean;
  supplier: boolean;
  rating: number;
  brand_warranty: string;
  countProducts: number;
}

export interface ProfitProductRaw {
  id: number;
  article_id: number;
  product_code: string;
  price: number;
  quantity: number;
  comment: string;
  article: string;
  brand: string;
  description: string;
  status_id: number;
  status: string;
  status_update: string;
  delivery_date?: string;
}

export interface ProfitOrderRaw {
  order_id: string;
  comment: string;
  datetime: string;

  // --- Добавленные поля ---
  payment_id?: string; // "1" или "2"
  payment_name?: string; // "Безналичные", "Наличные / Банковской картой"
  // ------------------------

  products: ProfitProductRaw[];
}

export interface ProfitGetOrdersResponse {
  pages: number;
  currentPage: number;
  pageSize: number;
  data: ProfitOrderRaw[];
}

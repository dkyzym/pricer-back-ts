export type AbcpSupplierAlias =
  | 'ug'
  | 'patriot'
  | 'ug_f'
  | 'npn'
  | 'ug_bn'
  | 'avtodinamika';

export interface AbcpBrandItem {
  name: string;
  aliases?: string[];
}

export interface AbcpArticleSearchResult {
  distributorId: number;
  grp: null;
  code: string | '';
  brand: string;
  number: string;
  numberFix: string;
  description: string;
  availability: number;
  packing: number;
  deliveryPeriod: number;
  /** API иногда отдаёт пустую строку вместо числа */
  deliveryPeriodMax: number | string;
  deadlineReplace: string;
  distributorCode: string;
  supplierCode: number;
  supplierColor: string | null;
  supplierDescription: string;
  itemKey: string;
  price: number;
  weight: number;
  volume: null;
  lastUpdateTime: string | Date;
  additionalPrice: number;
  noReturn: boolean;
  isUsed: boolean;
  meta: {
    productId: number;
    wearout: number;
    isUsed: boolean;
    images: null;
    abcpWh?: string;
  };
  deliveryProbability: 0;
}

/** Элемент справочника статусов (GET /orders/statuses) */
export interface AbcpOrderStatusItem {
  id: number;
  name: string;
  color: string;
  isFinalStatus: boolean;
}

export interface AbcpOrderPosition {
  positionId: string; // "711114201"
  brand: string; // "Luxe"
  number: string; // "602" (Артикул)
  numberFix?: string; // "602" (Очищенный артикул)
  description: string; // "Масло моторное..."
  quantity: string; // "2" (Приходит строкой!)
  price: string; // "578.87" (Приходит строкой с точкой)

  /** Текстовое название статуса от API */
  status: string; // "Готовится к отгрузке"
  /** id из справочника orders/statuses; API может отдавать number или string */
  statusId?: string | number;
  statusCode?: string;
  statusColor?: string; // "3ED208"
  statusDate?: string;

  deadline?: string; // "0"
  deadlineMax?: string; // "0"
  noReturn?: boolean;
  commentAnswer?: string;
}

/** Элемент списка заказов (GET /orders/); items — словарь по number */
export interface AbcpOrderRaw {
  number: string; // ID заказа "248143957"
  date: string; // "2026-02-02 12:17:10"
  status: string;
  statusId?: string | number;
  sum: string; // "2 040,74" (С пробелами и запятой!)
  positionsQuantity?: number;
  deliveryAddress?: string;
  positions?: AbcpOrderPosition[];
}

// Ответ от API ABCP /orders/
export interface AbcpOrdersResponse {
  count: string | number;
  items: Record<string, AbcpOrderRaw>; // Словарь заказов
}

// Параметры для запроса (помимо логина/пароля, которые вставит интерсептор)
export interface FetchOrdersParams {
  limit?: number; // по умолчанию 150
  skip?: number; // по умолчанию 0
  format?: 'p'; // 'p' для вывода позиций
  dateStart?: string; // 'DD.MM.YYYY'
  dateEnd?: string; // 'DD.MM.YYYY'
}

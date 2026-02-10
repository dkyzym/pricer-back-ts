export type AbcpSupplierAlias =
  | 'ug'
  | 'patriot'
  | 'ug_f'
  | 'npn'
  | 'ug_bn'
  | 'avtodinamika';

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
  deliveryPeriodMax: number;
  deadlineReplace: '';
  distributorCode: '';
  supplierCode: number;
  supplierColor: null;
  supplierDescription: '';
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
    abcpWh: string;
  };
  deliveryProbability: 0;
}

export interface AbcpOrderPosition {
  positionId: string; // "711114201"
  brand: string; // "Luxe"
  number: string; // "602" (Артикул)
  numberFix?: string; // "602" (Очищенный артикул)
  description: string; // "Масло моторное..."
  quantity: string; // "2" (Приходит строкой!)
  price: string; // "578.87" (Приходит строкой с точкой)

  // Статусы
  status: string; // "Готовится к отгрузке" (Текст!)
  statusId: string; // "82534"
  statusColor?: string; // "3ED208"

  // Даты и сроки
  deadline?: string; // "0"
  deadlineMax?: string; // "0"
}

// Описание заказа (Родительский объект)
export interface AbcpOrderRaw {
  number: string; // ID заказа "248143957"
  date: string; // "2026-02-02 12:17:10"
  status: string; // Общий статус заказа
  sum: string; // "2 040,74" (С пробелами и запятой!)
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
}

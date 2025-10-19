import { Logger } from 'winston';
import { SupplierName } from './common.types.js';

// --- Базовые типы ---

export interface ItemToParallelSearch {
  id: string;
  brand: string;
  article: string;
  description: string;
  dataUrl: string;
}

export interface getItemResultsParams {
  item: ItemToParallelSearch;
  supplier: SupplierName;
}

/**
 * Восстановленный тип для передачи полного контекста в сервисы.
 */
export interface ParallelSearchParams {
  item: ItemToParallelSearch;
  supplier: SupplierName;
  userLogger: Logger;
}


// --- Каноническая модель продукта (Ядро) ---

/**
 * Основная, каноническая модель данных о продукте.
 * Все хендлеры должны возвращать результат в этом формате.
 */
export interface Product {
  id: string;
  article: string;
  brand: string;
  description: string;
  price: number;
  availability: number | string;
  warehouse: string;
  deliveryDate?: string;
  deadline: number;
  deadLineMax: number;
  supplier: SupplierName;
  imageUrl: string;
  probability: number | '';
  needToCheckBrand?: boolean;
  returnable?: number;
  multi?: number;
}

// --- Расширенная модель для обратной совместимости ---

/**
 * Расширенный интерфейс результата поиска, включающий специфичные для поставщиков поля.
 * Он наследует все поля от базовой модели Product.
 */
export interface SearchResultsParsed extends Product {
  // Поля, которые могут быть не у всех
  innerId?: string;
  deadLineTimeToOrder?: string;
  allow_return?: boolean;
  warehouse_id?: string;
  inner_product_code?: string;
  deadlineReplace?: string; // Для patriot, npn

  //** Специфичные свойства для конкретных поставщиков */
  autosputnik?: {
    brand: string;
    id_shop_prices: string;
  };
  ug?: {
    itemKey: string;
    supplierCode: string;
  };
  ug_f?: {
    itemKey: string;
    supplierCode: string;
  };
  ug_bn?: {
    itemKey: string;
    supplierCode: string;
  };
  patriot?: {
    itemKey: string;
    supplierCode: string;
  };
  npn?: {
    itemKey: string;
    supplierCode: string;
  };
  avtodinamika?: {
    itemKey: string;
    supplierCode: string;
  };
}

// --- Тип для функции-хендлера (ваш существующий контракт) ---

export type SupplierHandler = (
  data: getItemResultsParams,
  userLogger: Logger
) => Promise<SearchResultsParsed[]>;


// --- Другие типы ---

export interface ItemAutocompleteRow {
  brand: string;
  number: string;
  descr: string;
  url: string;
  id?: string;
}

/**
 * Восстановленный тип-обертка для стандартизации ответов, отправляемых клиенту.
 * Сделан обобщенным (generic) для гибкого использования.
 */
export interface PageActionsResult<T> {
  success: boolean;
  message: string;
  data: T;
}


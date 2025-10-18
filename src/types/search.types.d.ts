import { Logger } from 'winston';
import { SupplierName } from './common.types.js';
import { PageActionsResult } from './page.types.js';

// Типы, относящиеся к процессу поиска товаров

export interface ItemToParallelSearch {
  id: string;
  brand: string;
  article: string;
  description: string;
  dataUrl: string;
}

export interface ParallelSearchParams {
  item: ItemToParallelSearch;
  supplier: SupplierName;
  userLogger: Logger;
}

/**
 * Основной интерфейс для унифицированного результата поиска от любого поставщика.
 */
export interface SearchResultsParsed {
  id: string;
  article: string;
  brand: string;
  description: string;
  availability: number | string;
  price: number;
  warehouse: string;
  imageUrl: string;
  deadline: number;
  deadLineMax: number;
  supplier: SupplierName;
  probability: number | '';
  needToCheckBrand?: boolean;
  innerId?: string;
  deadLineTimeToOrder?: string;
  deliveryDate?: string;
  returnable?: number;
  multi?: number;
  allow_return?: boolean;
  warehouse_id?: string;
  inner_product_code?: string;

  //** Свойства для Автоспутник*/
  autosputnik?: {
    brand: string; // id бренда по в системе BRA_ID
    id_shop_prices: string;
  };

  //** Свойства для UG*/
  ug?: {
    itemKey: string;
    supplierCode: string;
  };
}

export interface ItemAutocompleteRow {
  brand: string;
  number: string;
  descr: string;
  url: string;
  id?: string;
}

export interface ClarifyBrandResult {
  success: boolean;
  brands: ItemAutocompleteRow[];
  message: string;
}

export interface getItemResultsParams {
  item: ItemToParallelSearch;
  supplier: SupplierName;
}

export interface SearchResult {
  supplier: SupplierName;
  result: PageActionsResult | null;
}

export interface PageActionsResult {
  success: boolean;
  message: string;
  data?: ItemToParallelSearch[] | SearchResultsParsed[];
}

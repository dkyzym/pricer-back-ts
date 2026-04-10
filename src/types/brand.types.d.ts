import type { ItemAutocompleteRow } from './search.types.js';

/**
 * Сводка по источникам уточнения бренда (ug, npn, patriot, profit, armtek, mikano, autoImpulse).
 * total совпадает с числом параллельных запросов в clarifyBrand.
 */
export interface BrandClarificationSupplierStats {
  total: number;
  successful: number;
  failedSupplierKeys: string[];
}

export interface ClarifyBrandResult {
  brands: ItemAutocompleteRow[];
  message: string;
  supplierStats: BrandClarificationSupplierStats;
}

import { SupplierName } from "../../types/common.types";


/**
 * Конфигурация для отдельных поставщиков.
 * - `maxItems`: Абсолютное максимальное количество позиций для возврата от этого поставщика.
 * - `topPercent`: Пользовательский процент лучших позиций (переопределяет глобальный TOP_PERCENT).
 * - `minProbability`: Пользовательский порог минимальной вероятности (переопределяет глобальный MIN_PROBABILITY).
 *
 * Все поля опциональны.
 */
export const SUPPLIER_CONFIG: Record<
  SupplierName,
  {
    maxItems?: number;
    topPercent?: number;
    minProbability?: number;
  }
> = {
  ug: {
    maxItems: 3,
  },
  profit: {
    maxItems: 3,
  },
  autosputnik: {
    maxItems: 3,
  },
  autosputnik_bn: {
    maxItems: 3,
  },
  armtek: {
    maxItems: 3,
  },
  autoImpulse: {},
  patriot: {},
  ug_f: { maxItems: 3 },
  ug_bn: { maxItems: 3 },
  npn: {},
  mikano: {},
  avtodinamika: { maxItems: 2 },
  avtoPartner: {}
};

/**
 * Список поставщиков, к которым будет применяться логика фильтрации и сортировки.
 * Результаты от поставщиков не из этого списка будут возвращены "как есть".
 */
export const FILTERED_SUPPLIERS: SupplierName[] = [
  'ug',
  'profit',
  'autosputnik',
  'autosputnik_bn',
  'armtek',
  'patriot',
  'autoImpulse',
  'npn',
  'ug_bn',
  'ug_f',
  'avtodinamika',
  'avtoPartner'
];

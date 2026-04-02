import { SupplierName } from '../../types/common.types';

/**
 * Конфигурация для отдельных поставщиков.
 * - `maxItems`: Абсолютное максимальное количество позиций для возврата от этого поставщика.
 * - `topPercent`: Пользовательский процент лучших позиций (переопределяет глобальный TOP_PERCENT).
 * - `minProbability`: Пользовательский порог минимальной вероятности (переопределяет глобальный MIN_PROBABILITY).
 * - `minTopByPriceSlice`: В ветке «top% + fastest» не брать меньше N позиций из отсортированного по цене списка
 *   (иначе при малом topPercent и 5–9 строках получается ceil(n*0.1)=1 и после дедупа с «быстрой» остаётся одна строка).
 *
 * Все поля опциональны.
 */
export const SUPPLIER_CONFIG: Record<
  SupplierName,
  {
    maxItems?: number;
    topPercent?: number;
    minProbability?: number;
    minTopByPriceSlice?: number;
  }
> = {
  ug: {
    maxItems: 3,
  },
  profit: {
    maxItems: 3,
  },
  autosputnik: {
    maxItems: 4,
  },
  autosputnik_bn: {
    maxItems: 4,
  },
  armtek: {
    maxItems: 3,
    minTopByPriceSlice: 3,
  },
  autoImpulse: {},
  patriot: {},
  ug_f: { maxItems: 3 },
  ug_bn: { maxItems: 3 },
  npn: {},
  mikano: {},
  avtodinamika: { maxItems: 2 },
  avtoPartner: {},
  turboCars: { maxItems: 2 },
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
  'avtoPartner',
  'turboCars',
];

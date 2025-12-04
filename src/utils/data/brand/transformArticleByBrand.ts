import { SupplierName } from '../../../types/common.types.js';
import { cleanArticleString } from './cleanArticleString.js';
import { standardizeString } from './standardizeString.js';

const EXCLUDED_SUPPLIERS: SupplierName[] = [
  'ug',
  'ug_f',
  'ug_bn',
  'avtoPartner',
];

const TARGET_BRAND_SET = new Set([
  standardizeString('БРТ'),
  standardizeString('Tadem'),
  standardizeString('Балаковорезинотехника'),
  standardizeString('BRT'),
]);

/**
 * Проверяет, относится ли бренд к группе БРТ/Tadem/Балаково.
 * Экспортируем для использования в фильтрации результатов.
 */
export const isBrtBrand = (brand: string): boolean => {
  return TARGET_BRAND_SET.has(standardizeString(brand));
};

/**
 * Трансформирует артикул на основе специфичных правил для бренда.
 * (e.g., для 'БРТ' превращает 'РК15' -> 'РЕМКОМПЛЕКТ15').
 */
export const transformArticleByBrand = (
  rawArticle: string,
  rawBrand: string,
  supplier: SupplierName
): string => {
  // Шаг 1: Проверка-исключение
  if (EXCLUDED_SUPPLIERS.includes(supplier)) {
    return rawArticle;
  }

  // Шаг 2: Проверяем, наш ли это бренд
  if (!isBrtBrand(rawBrand)) {
    // Это не 'БРТ' — выходим
    return rawArticle;
  }

  // Шаг 3: Проверяем артикул
  const cleanedArticle = cleanArticleString(rawArticle); // 'рк15' -> 'РК15'

  const isTargetArticle =
    cleanedArticle.startsWith('РК') &&
    cleanedArticle.length > 2 &&
    /\d/.test(cleanedArticle[2]); // Проверяем, что 3-й символ - цифра

  // Шаг 4: Трансформация
  if (isTargetArticle) {
    const transformedArticle = cleanedArticle.replace('РК', 'РЕМКОМПЛЕКТ');
    return transformedArticle; // 'РК15' -> 'РЕМКОМПЛЕКТ15'
  }

  // Если ничего не подошло, возвращаем как есть
  return rawArticle;
};

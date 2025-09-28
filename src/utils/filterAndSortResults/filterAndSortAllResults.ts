import { DateTime } from 'luxon';
import { SearchResultsParsed, SupplierName } from '../../types/index.js';
import { FILTERED_SUPPLIERS, SUPPLIER_CONFIG } from './filterAndSortConfig.js';

const MIN_PROBABILITY = 80;
const MIN_RESULTS = 4;
const TOP_PERCENT = 0.1; // 10%
const MS_PER_HOUR = 3600000;
const DEFAULT_DEADLINE_HOURS = 9999999;

/**
 * Вычисляет время доставки в миллисекундах для элемента результата поиска.
 * Приоритет отдается 'deliveryDate', затем используется 'deadLineMax' в часах,
 * и в крайнем случае — значение по умолчанию.
 * @param item - Элемент результата поиска.
 * @returns Время доставки в миллисекундах.
 */
const getDeliveryTimeInMs = (item: SearchResultsParsed): number => {
  if (item.deliveryDate) {
    return DateTime.fromISO(item.deliveryDate).toMillis();
  }
  const hours = item.deadLineMax || DEFAULT_DEADLINE_HOURS;
  return hours * MS_PER_HOUR;
};

/**
 * Сортирует два элемента результата поиска: сначала по цене (по возрастанию),
 * а при равной цене — по времени доставки (по возрастанию).
 * @param a - Первый элемент для сравнения.
 * @param b - Второй элемент для сравнения.
 * @returns Число, определяющее порядок сортировки.
 */
const sortByPriceAndDelivery = (
  a: SearchResultsParsed,
  b: SearchResultsParsed
): number => {
  if (a.price !== b.price) {
    return a.price - b.price;
  }
  return getDeliveryTimeInMs(a) - getDeliveryTimeInMs(b);
};

/**
 * Находит позицию с самым ранним сроком поставки в массиве результатов.
 * @param items - Массив элементов для поиска.
 * @returns Позицию с наименьшим временем доставки или undefined, если массив пуст.
 */
const findFastestItem = (
  items: SearchResultsParsed[]
): SearchResultsParsed | undefined => {
  return items.reduce<SearchResultsParsed | undefined>((fastest, current) => {
    if (!fastest) return current;
    return getDeliveryTimeInMs(current) < getDeliveryTimeInMs(fastest)
      ? current
      : fastest;
  }, undefined);
};

/**
 * Удаляет дубликаты из массива на основе составного ключа.
 * 'availability' является частью ключа.
 * @param items - Массив для дедупликации.
 * @returns Новый массив без дубликатов.
 */
const removeDuplicates = (
  items: SearchResultsParsed[]
): SearchResultsParsed[] => {
  const seen = new Map<string, SearchResultsParsed>();

  for (const item of items) {
    const probability =
      typeof item.probability === 'string'
        ? parseFloat(item.probability)
        : item.probability || 0;

    const availability =
      typeof item.availability === 'string'
        ? parseFloat(item.availability)
        : item.availability || 0;

    const refusalInfo = `${item.returnable ?? ''}_${item.allow_return ?? ''}`;
    const deliveryTime = getDeliveryTimeInMs(item);

    const key = [
      probability,
      availability,
      deliveryTime,
      refusalInfo,
      item.price,
    ].join('|');

    if (!seen.has(key)) {
      seen.set(key, item);
    }
  }

  return Array.from(seen.values());
};

/**
 * Фильтрует и обрезает результаты для одного поставщика на основе правил из конфигурации.
 * @param data - Результаты поиска для одного поставщика.
 * @param supplierName - Имя поставщика.
 * @returns Обработанный массив результатов поиска для данного поставщика.
 */
const filterSupplierData = (
  data: SearchResultsParsed[],
  supplierName: SupplierName
): SearchResultsParsed[] => {
  const supplierConfig = SUPPLIER_CONFIG[supplierName] || {};
  const minProb = supplierConfig.minProbability ?? MIN_PROBABILITY;

  // 1. Фильтруем по вероятности
  let filtered = data.filter((item) => {
    const prob =
      typeof item.probability === 'string'
        ? parseFloat(item.probability)
        : item.probability;
    return (prob || 0) >= minProb;
  });

  if (filtered.length === 0) return [];

  // 2. Удаляем дубликаты
  filtered = removeDuplicates(filtered);

  // 3. Сортируем по цене и времени доставки
  filtered.sort(sortByPriceAndDelivery);

  let resultToShow: SearchResultsParsed[];

  // 4. Если позиций мало, берем все
  if (filtered.length <= MIN_RESULTS) {
    resultToShow = filtered;
  } else {
    // 5. Иначе, берем N% лучших по цене
    const percent = supplierConfig.topPercent ?? TOP_PERCENT;
    const limitByPercent = Math.ceil(filtered.length * percent);
    const topByPrice = filtered.slice(0, limitByPercent);

    // 6. Находим самую быструю позицию из всего отфильтрованного списка
    const fastestItem = findFastestItem(filtered);

    // 7. Объединяем лучшие по цене с самой быстрой
    const combinedItems = [...topByPrice];
    if (fastestItem) {
      combinedItems.push(fastestItem);
    }

    // 8. Снова убираем дубликаты и сортируем
    const finalCombined = removeDuplicates(combinedItems);
    finalCombined.sort(sortByPriceAndDelivery);
    resultToShow = finalCombined;
  }

  // 9. Применяем финальное ограничение `maxItems` вне зависимости от выбранной логики
  const maxItems = supplierConfig.maxItems;
  if (typeof maxItems === 'number' && resultToShow.length > maxItems) {
    resultToShow = resultToShow.slice(0, maxItems);
  }

  return resultToShow;
};

/**
 * Группирует результаты поиска по поставщикам и применяет правила фильтрации
 * и сортировки к указанным в конфигурации поставщикам.
 * @param data - Массив результатов поиска, возможно, от нескольких поставщиков.
 * @returns Единый массив с обработанными результатами поиска.
 */
export const filterAndSortAllResults = (
  data: SearchResultsParsed[]
): SearchResultsParsed[] => {
  // Группируем результаты по поставщику
  const groups = data.reduce<Record<SupplierName, SearchResultsParsed[]>>(
    (acc, item) => {
      if (!acc[item.supplier]) {
        acc[item.supplier] = [];
      }
      acc[item.supplier].push(item);
      return acc;
    },
    {} as Record<SupplierName, SearchResultsParsed[]>
  );

  const finalResults: SearchResultsParsed[] = [];
  // Обрабатываем каждую группу поставщика
  for (const supplierName of Object.keys(groups) as SupplierName[]) {
    const supplierData = groups[supplierName];
    if (FILTERED_SUPPLIERS.includes(supplierName)) {
      finalResults.push(...filterSupplierData(supplierData, supplierName));
    } else {
      // Для нефильтруемых поставщиков возвращаем данные "как есть"
      finalResults.push(...supplierData);
    }
  }

  return finalResults;
};

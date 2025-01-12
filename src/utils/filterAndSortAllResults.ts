import { DateTime } from 'luxon';
import { SearchResultsParsed, SupplierName } from '../types';

const MIN_PROBABILITY = 80;
const MIN_RESULTS = 4;
const TOP_PERCENT = 0.1; // 10%
const MS_PER_HOUR = 3600000; // 1000 * 60 * 60
const DEFAULT_DEADLINE_HOURS = 9999999; // «огромная» цифра вместо магического 9999999999

// Список поставщиков, которых фильтруем
const FILTERED_SUPPLIERS: SupplierName[] = ['ug', 'profit', 'autosputnik'];

/**
 * Получаем «время поставки» в миллисекундах:
 *  - при наличии deliveryDate — берём её;
 *  - иначе берём deadLineMax (в часах) и умножаем на MS_PER_HOUR;
 *  - если оба не заданы, берём что-то очень большое (DEFAULT_DEADLINE_HOURS).
 */
const getDeliveryTimeInMs = (item: SearchResultsParsed): number => {
  if (item.deliveryDate) {
    return DateTime.fromISO(item.deliveryDate).toMillis();
  }
  const hours = item.deadLineMax || DEFAULT_DEADLINE_HOURS;
  return hours * MS_PER_HOUR;
};

/**
 * Сортируем по возрастанию цены, при равной цене — по дате/сроку поставки (чем раньше, тем лучше).
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
 * Выделяем самый быстрый вариант по deliveryDate/deadLineMax
 * (меньшее getDeliveryTimeInMs — быстрее).
 */
const findFastestItem = (
  items: SearchResultsParsed[]
): SearchResultsParsed | undefined => {
  return items.reduce(
    (fastest, current) => {
      if (!fastest) return current;
      return getDeliveryTimeInMs(current) < getDeliveryTimeInMs(fastest)
        ? current
        : fastest;
    },
    undefined as SearchResultsParsed | undefined
  );
};

/**
 * Фильтрация и «подрезка» массива для одного «фильтруемого» поставщика.
 * 1. probability >= MIN_PROBABILITY
 * 2. сортируем
 * 3. берём либо все, если <= MIN_RESULTS (4)
 *    либо верхние TOP_PERCENT (20%)
 * 4. добавляем в итоговый массив самый быстрый вариант,
 *    если вдруг он не вошёл в срез
 */
const filterSupplierData = (
  data: SearchResultsParsed[]
): SearchResultsParsed[] => {
  // 1. Фильтр по вероятности
  const filtered = data.filter((item) => {
    const prob =
      typeof item.probability === 'string'
        ? parseFloat(item.probability)
        : item.probability;
    return prob >= MIN_PROBABILITY;
  });

  if (filtered.length === 0) return []; // Если все отсеялись

  // 2. Сортируем
  filtered.sort(sortByPriceAndDelivery);

  // 3. Если <= MIN_RESULTS, отдаём все
  if (filtered.length <= MIN_RESULTS) {
    return filtered;
  }

  // Иначе берём верхние TOP_PERCENT
  const limit = Math.ceil(filtered.length * TOP_PERCENT);
  let result = filtered.slice(0, limit);

  // 4. Добавляем самый быстрый вариант, если его нет
  const fastest = findFastestItem(filtered);
  if (fastest && !result.includes(fastest)) {
    result.push(fastest);
    // возможно, после добавления снова отсортируем
    result.sort(sortByPriceAndDelivery);
  }

  return result;
};

/**
 * Общая функция:
 *  - Группируем по supplier
 *  - Для каждого «фильтруемого» поставщика (ug, profit, autosputnik) применяем логику filterSupplierData
 *  - Остальным (turboCars, patriot, autoImpulse) возвращаем данные «как есть»
 *  - Склеиваем и возвращаем
 */
export const filterAndSortAllResults = (
  data: SearchResultsParsed[]
): SearchResultsParsed[] => {
  // Группируем
  const groups = data.reduce<Record<SupplierName, SearchResultsParsed[]>>(
    (acc, item) => {
      if (!acc[item.supplier]) acc[item.supplier] = [];
      acc[item.supplier].push(item);
      return acc;
    },
    {} as Record<SupplierName, SearchResultsParsed[]>
  );

  // Пробегаемся по группам
  const result: SearchResultsParsed[] = [];
  for (const supplierName of Object.keys(groups) as SupplierName[]) {
    const supplierData = groups[supplierName];
    if (FILTERED_SUPPLIERS.includes(supplierName)) {
      // Применяем фильтр/сортировку
      result.push(...filterSupplierData(supplierData));
    } else {
      // Оставляем как есть
      result.push(...supplierData);
    }
  }

  return result;
};

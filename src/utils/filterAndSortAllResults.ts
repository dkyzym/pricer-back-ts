import { DateTime } from 'luxon';
import { SearchResultsParsed, SupplierName } from '../types/index.js';

const MIN_PROBABILITY = 80;
// Минимальное количество, которое берём «безоговорочно», если общее кол-во <= этого числа
const MIN_RESULTS = 4;
// Процент позиций, которые будем брать (если общее кол-во > MIN_RESULTS)
const TOP_PERCENT = 0.1; // 10%
const MS_PER_HOUR = 3600000;
const DEFAULT_DEADLINE_HOURS = 9999999;

/**
 * Пример дополнительной конфигурации для каждого поставщика.
 * - maxItems: максимальное число позиций, которое хотим вернуть
 * - topPercent: процент, если требуется свой для каждого поставщика,
 *               а не общий (можно не указывать, тогда возьмётся общий TOP_PERCENT).
 * - minProbability: вдруг хотим задать собственный минимальный порог вероятности?
 *
 * Все поля — опциональные.
 */
const SUPPLIER_CONFIG: Record<
  SupplierName,
  {
    maxItems?: number;
    topPercent?: number;
    minProbability?: number;
  }
> = {
  ug: {
    maxItems: 5,
  },
  profit: {
    maxItems: 4,
  },
  autosputnik: {
    maxItems: 4,
  },
  armtek: {
    maxItems: 4,
    // не задали ничего, значит будем использовать глобальные значения
  },
  turboCars: {
    maxItems: 7,
    minProbability: 90,
  },
  autoImpulse: {},
  patriot: {},
};

/**
 * Список поставщиков, для которых применяется логика фильтра/среза.
 * Остальные вернём «как есть».
 */
const FILTERED_SUPPLIERS: SupplierName[] = [
  'ug',
  'profit',
  'autosputnik',
  'armtek',
  'turboCars',
  'patriot',
  'autoImpulse',
  // при необходимости добавим других
];

/**
 * Получаем «время поставки» в миллисекундах:
 *  - при наличии deliveryDate — берём её;
 *  - иначе берём deadLineMax (в часах);
 *  - если оба не заданы, берём DEFAULT_DEADLINE_HOURS.
 */
const getDeliveryTimeInMs = (item: SearchResultsParsed): number => {
  if (item.deliveryDate) {
    return DateTime.fromISO(item.deliveryDate).toMillis();
  }
  const hours = item.deadLineMax || DEFAULT_DEADLINE_HOURS;
  return hours * MS_PER_HOUR;
};

/**
 * Сортируем по возрастанию цены,
 * при равной цене — по возрастанию времени поставки (чем раньше, тем лучше).
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
 * Находим самый быстрый вариант среди позиций (по минимальному времени поставки).
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
 * Удаляем «дубликаты» среди позиций.
 * Дубликатом считаем ситуацию, когда probability, availability,
 * время поставки, возможность возврата и цена — одинаковые.
 *
 * Оставляем первый встретившийся (с учётом, что массив может быть уже отсортирован).
 */
const removeDuplicates = (
  items: SearchResultsParsed[]
): SearchResultsParsed[] => {
  const seen = new Map<string, SearchResultsParsed>();

  for (const item of items) {
    const prob =
      typeof item.probability === 'string'
        ? parseFloat(item.probability)
        : item.probability || 0;

    const availability =
      typeof item.availability === 'string'
        ? parseFloat(item.availability)
        : item.availability || 0;

    // Возможность возврата/отказа — используем связку из returnable и allow_return
    const refusalInfo = `${item.returnable ?? ''}_${item.allow_return ?? ''}`;
    const deliveryTime = getDeliveryTimeInMs(item);

    const key = [
      prob,
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
 * Фильтрация и «подрезка» массива для одного поставщика.
 *
 * Шаги:
 * 1) probability >= (MIN_PROBABILITY или свой из SUPPLIER_CONFIG)
 * 2) Сортируем (по цене, затем по времени)
 * 3) Если позиций <= MIN_RESULTS (например 4), возвращаем все
 * 4) Иначе берём верхние TOP_PERCENT (или topPercent из конфига),
 *    при желании можно брать min/max с учётом maxItems
 * 5) Добавляем самый быстрый вариант, если его там нет
 * 6) Убираем «дубликаты» (если оказались равнозначные)
 */
const filterSupplierData = (
  data: SearchResultsParsed[],
  supplierName: SupplierName
): SearchResultsParsed[] => {
  // 1. Фильтр по вероятности
  const minProb =
    SUPPLIER_CONFIG[supplierName]?.minProbability ?? MIN_PROBABILITY;
  const filtered = data.filter((item) => {
    const prob =
      typeof item.probability === 'string'
        ? parseFloat(item.probability)
        : item.probability;
    return (prob || 0) >= minProb;
  });

  if (filtered.length === 0) return [];

  // 2. Сортируем
  filtered.sort(sortByPriceAndDelivery);

  // 3. Если после фильтрации и сортировки позиций <= MIN_RESULTS — возвращаем все
  if (filtered.length <= MIN_RESULTS) {
    // Добавим самый быстрый, если вдруг его нет (на практике при <= MIN_RESULTS он обычно и так внутри)
    const fastest = findFastestItem(filtered);
    if (fastest && !filtered.includes(fastest)) {
      filtered.push(fastest);
      filtered.sort(sortByPriceAndDelivery);
    }
    // Убираем дубликаты
    return removeDuplicates(filtered);
  }

  // Иначе берём верхние TOP_PERCENT (или своё значение из конфига)
  const percent = SUPPLIER_CONFIG[supplierName]?.topPercent ?? TOP_PERCENT;
  const limitByPercent = Math.ceil(filtered.length * percent);

  // Если для данного поставщика указан maxItems — учтём его.
  let limit = limitByPercent;
  const maxItems = SUPPLIER_CONFIG[supplierName]?.maxItems;
  if (typeof maxItems === 'number') {
    // например, берём минимум из «процентного среза» и maxItems
    limit = Math.min(limitByPercent, maxItems);
  }

  // Берём «срез»
  let result = filtered.slice(0, limit);

  // 5. Добавляем самый быстрый вариант, если его там нет
  const fastest = findFastestItem(filtered);
  if (fastest && !result.includes(fastest)) {
    result.push(fastest);
  }

  // 6. Сортируем снова и убираем дубликаты
  result.sort(sortByPriceAndDelivery);
  result = removeDuplicates(result);

  return result;
};

/**
 * Общая функция:
 *  - Группируем по supplier
 *  - Для каждого «фильтруемого» поставщика (из FILTERED_SUPPLIERS)
 *    применяем логику filterSupplierData
 *  - Остальным возвращаем данные «как есть»
 *  - Склеиваем и возвращаем
 */
export const filterAndSortAllResults = (
  data: SearchResultsParsed[]
): SearchResultsParsed[] => {
  // Группируем по supplier
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

  // Пробегаемся по группам и собираем результат
  const result: SearchResultsParsed[] = [];
  for (const supplierName of Object.keys(groups) as SupplierName[]) {
    const supplierData = groups[supplierName];
    if (FILTERED_SUPPLIERS.includes(supplierName)) {
      result.push(...filterSupplierData(supplierData, supplierName));
    } else {
      // Оставляем как есть, без фильтров
      result.push(...supplierData);
    }
  }

  return result;
};

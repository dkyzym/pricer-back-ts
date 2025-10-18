import { DateTime } from 'luxon';
import { v4 as uuidv4 } from 'uuid';
// import { SearchResultsParsed } from '../../types';
import { SearchResponseItem, StoreResponseItem } from './armtek.types.js';
import { SearchResultsParsed } from '../../types/search.types.js';

/**
 * Считает приблизительное количество рабочих часов (8 часов в день, 5 дней в неделю)
 * между двумя датами (from -> to).
 * Здесь мы игнорируем частичные дни, праздники и т.д.,
 * просто считаем, сколько "полных рабочих дней" попадёт между from и to.
 *
 * Если to <= from, возвращаем 0.
 */
function getBusinessHoursBetween(from: DateTime, to: DateTime): number {
  // Если конечная дата раньше или равна начальной, вернём 0
  if (to <= from) return 0;

  let daysCount = 0;
  // Начинаем с полуночи "from", чтобы считать полный день
  let cursor = from.startOf('day');

  // Перебираем все дни, пока не достигнем to (по датам без учёта часов)
  while (cursor < to) {
    // Понедельник (1) ... Пятница (5)
    if (cursor.weekday >= 1 && cursor.weekday <= 5) {
      daysCount++;
    }
    cursor = cursor.plus({ days: 1 });
  }

  // Каждый рабочий день = 8 часов
  const hours = daysCount * 8;
  return hours;
}

/**
 * Возвращает приблизительные рабочие часы до даты поставки
 * (WRNTDT, если есть, иначе DLVDT), считая с "сейчас" (DateTime.now()).
 */
function getApproxDeliveryHours(WRNTDT?: string, DLVDT?: string): number {
  // Определяем, какую строку использовать
  const rawDateStr = WRNTDT && WRNTDT.trim() ? WRNTDT : DLVDT;
  if (!rawDateStr) {
    // Если нет ни WRNTDT, ни DLVDT, возвращаем большое число или 0
    return 0;
  }

  // Парсим строку, например: '20250131123045' => 'yyyyMMddHHmmss'
  const deliveryDate = DateTime.fromFormat(rawDateStr, 'yyyyMMddHHmmss');
  if (!deliveryDate.isValid) {
    // Если парсинг неудачен, вернём 0 (или что-то по договорённости)
    return 0;
  }

  // Считаем рабочие часы между сейчас и датой поставки
  const now = DateTime.now();
  return getBusinessHoursBetween(now, deliveryDate);
}

/**
 * Функция пытается извлечь число из строки.
 * Сначала пробует parseFloat, а если он возвращает NaN (например, если строка начинается с символа),
 * то ищет первую последовательность цифр с возможной десятичной точкой.
 *
 * @param value - строка с информацией о наличии
 * @returns извлечённое число или NaN, если число не найдено
 */
function extractNumber(value: string): number {
  // Пробуем стандартный parseFloat
  let num = parseFloat(value);
  if (!Number.isNaN(num)) {
    return num;
  }
  // Если parseFloat не смог преобразовать строку, ищем числовую последовательность внутри строки
  const match = value.match(/(\d+(\.\d+)?)/);
  if (match) {
    num = parseFloat(match[0]);
    return num;
  }
  return NaN;
}

/**
 * Парсит результаты Armtek, сопоставляя KEYZAK со складом из storeList
 * и считает `deadline` (приблизительные рабочие часы) по схеме:
 *  - если есть WRNTDT, считаем по нему
 *  - если WRNTDT нет, используем DLVDT
 */
export function parseArmtekResults(
  relevantItems: SearchResponseItem[],
  storeList: StoreResponseItem[]
): SearchResultsParsed[] {
  return relevantItems.map((res) => {
    // Конвертация в числа
    const availabilityNumber = res.RVALUE ? extractNumber(res.RVALUE) : 0;
    const priceNumber = res.PRICE ? parseFloat(res.PRICE) : 0;
    const probabilityNumber = res.VENSL ? parseInt(res.VENSL, 10) : NaN;

    // Получаем склад (по совпадению KEYZAK)
    const store = storeList.find((st) => st.KEYZAK === res.KEYZAK);

    // Пример получения приблизительного дедлайна (в часах)
    const approximateHours = getApproxDeliveryHours(res.WRNTDT, res.DLVDT);

    // Пример получения даты в формате 'yyyy-MM-dd' (если она нужна для поля deliveryDate)
    const deliveryDate =
      res.WRNTDT || res.DLVDT
        ? (DateTime.fromFormat(
            res.WRNTDT || res.DLVDT || '',
            'yyyyMMddHHmmss'
          ).toISODate() ?? '2999-01-01')
        : '2999-01-01';

    // Собираем итоговый объект
    const result: SearchResultsParsed = {
      id: uuidv4(),
      article: res.PIN ?? '',
      brand: res.BRAND ?? '',
      description: res.NAME ?? '',
      availability: Number.isNaN(availabilityNumber) ? 0 : availabilityNumber,
      price: priceNumber,
      // Здесь кладём SKLNAME, если есть. Если нет — fallback на KEYZAK или ''
      warehouse: store?.SKLNAME || res.KEYZAK || '',
      imageUrl: '',
      // deadline = приблизительные рабочие часы
      deadline: approximateHours,
      deadLineMax: 0, // или по-другому, если нужно
      supplier: 'armtek',
      probability: Number.isNaN(probabilityNumber) ? '' : probabilityNumber,

      needToCheckBrand: false,
      innerId: '',
      deadLineTimeToOrder: '',
      deliveryDate: deliveryDate,
      returnable: res.RETDAYS || 0,
      multi: res.RDPRF ? parseInt(res.RDPRF, 10) : 1,
      allow_return: res.RETDAYS && res.RETDAYS > 0 ? true : false,
      warehouse_id: res.KEYZAK ?? '',
      inner_product_code: res.ARTID ?? '',
    };

    return result;
  });
}

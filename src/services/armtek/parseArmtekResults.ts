import { DateTime } from 'luxon';
import { v4 as uuidv4 } from 'uuid';
import { SearchResultsParsed } from '../../types';
import { SearchResponseItem, StoreResponseItem } from '../../types/armtek';

/**
 * Парсит результаты Armtek, сопоставляя KEYZAK со складом из storeList
 */
export function parseArmtekResults(
  relevantItems: SearchResponseItem[],
  storeList: StoreResponseItem[]
): SearchResultsParsed[] {
  return relevantItems.map((res) => {
    // Конвертация в числа
    const availabilityNumber = res.RVALUE ? parseFloat(res.RVALUE) : 0;
    const priceNumber = res.PRICE ? parseFloat(res.PRICE) : 0;
    const venSlNumber = res.VENSL ? parseInt(res.VENSL, 10) : NaN;

    // Получаем склад (по совпадению KEYZAK)
    const store = storeList.find((st) => st.KEYZAK === res.KEYZAK);

    // Формируем дату поставки
    const deliveryDate = res.DLVDT
      ? (DateTime.fromFormat(res.DLVDT, 'yyyyMMddHHmmss').toISODate() ??
        '2999-01-01')
      : '2999-01-01';

    // Собираем итоговый объект
    const result: SearchResultsParsed = {
      id: uuidv4(),
      article: res.PIN ?? '',
      brand: res.BRAND ?? '',
      description: res.NAME ?? '',
      availability: Number.isNaN(availabilityNumber) ? '' : availabilityNumber,
      price: priceNumber,
      // Здесь кладём SKLNAME, если есть. Если нет — fallback на KEYZAK или вообще ''
      warehouse: store?.SKLNAME || res.KEYZAK || '',
      imageUrl: '',
      deadline: 0,
      deadLineMax: 0,
      supplier: 'armtek',
      probability: Number.isNaN(venSlNumber) ? '' : venSlNumber,

      needToCheckBrand: false,
      innerId: '',
      deadLineTimeToOrder: '',
      deliveryDate: deliveryDate,
      returnable: res.RETDAYS || 0,
      multi: res.RDPRF ? parseInt(res.RDPRF, 10) : 1,
      allow_return: res.RETDAYS && res.RETDAYS > 0 ? 'YES' : 'NO',
      warehouse_id: res.KEYZAK ?? '',
      inner_product_code: res.ARTID ?? '',
    };

    return result;
  });
}

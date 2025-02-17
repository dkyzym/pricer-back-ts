import { DateTime } from 'luxon';
import { v4 as uuidv4 } from 'uuid';
import { SearchResultsParsed } from '../../types';
import { SearchResponseItem } from '../../types/armtek';

export const parseArmtekResults = (
  relevantItems: SearchResponseItem[]
): SearchResultsParsed[] => {
  const parsedResults = relevantItems.map((res) => {
    // В некоторых случаях нужно конвертировать строки в числа
    const availabilityNumber = res.RVALUE ? parseFloat(res.RVALUE) : 0;
    const priceNumber = res.PRICE ? parseFloat(res.PRICE) : 0;
    const probabilityNumber = res.VENSL ? parseInt(res.VENSL, 10) : '';

    // Пример «дедлайна». Если хотите высчитывать из строки DLVDT (YYYYMMDDHHIISS),
    // можно разобрать дату, но тут для простоты поставим 0 (или какую-то свою логику).
    const deadlineNumber = 0;
    const deadLineMaxNumber = 0;

    // Преобразование DLVDT (формат YYYYMMDDHHmmss) в ISO-дату
    const deliveryDate = res.DLVDT
      ? DateTime.fromFormat(res.DLVDT, 'yyyyMMddHHmmss').toISODate() ||
        '2999-01-01'
      : '2999-01-01';

    // Собираем объект
    const result: SearchResultsParsed = {
      id: uuidv4(), // или можно использовать другой уникальный идентификатор
      article: res.PIN ?? '',
      brand: res.BRAND ?? '',
      description: res.NAME ?? '',
      availability: isNaN(availabilityNumber) ? '' : availabilityNumber,
      price: priceNumber,
      warehouse: res.KEYZAK ?? '',
      imageUrl: '', // если у вас нет изображения, можно оставить пустым
      deadline: deadlineNumber,
      deadLineMax: deadLineMaxNumber,
      supplier: 'armtek', // или берёте из переменной
      probability: probabilityNumber || '',

      // Далее поля, которые у вас в SearchResultsParsed
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
  return parsedResults;
};

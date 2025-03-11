import { v4 as uuidv4 } from 'uuid';
import {
  SearchResultsParsed,
  ugArticleSearchResult,
} from '../../types/index.js';
import { calculateDeliveryDate } from '../../utils/calculateDates/index.js';
import { isBrandMatch } from '../../utils/data/isBrandMatch.js';

export const mapUgResponseData = (
  data: ugArticleSearchResult[],
  brand: string
): SearchResultsParsed[] => {
  const mappedResponseData: SearchResultsParsed[] = data.map((item) => {
    const ownWarehouses = ['краснодар', 'ростов']; // считаем что это родные склады ЮГ
    // Приводим описание поставщика к нижнему регистру для корректного поиска
    const supplierDescriptionLower = item.supplierDescription.toLowerCase();
    // Если в строке содержится "краснодар" или "ростов", то probability будет 95 процентов
    const probability = ownWarehouses.some((warehouse) =>
      supplierDescriptionLower.includes(warehouse)
    )
      ? 95
      : item.deliveryProbability;

    return {
      id: uuidv4(),
      article: item.number,
      brand: item.brand,
      description: item.description,
      availability: item.availability, // отрицательные значения: -1, -2, -3 означают "неточное" наличие, а -10 — наличие "под заказ".
      price: item.price,
      warehouse: item.supplierDescription,
      imageUrl: '',
      deadline: item.deliveryPeriod || 1,
      deadLineMax: item.deliveryPeriodMax || 1,
      supplier: 'ug',
      probability,
      needToCheckBrand: !isBrandMatch(brand, item.brand),
      returnable: Number(!item.noReturn),
      multi: item.packing || 1,
      allow_return: !item.noReturn,
      warehouse_id: String(item.supplierCode),
      inner_product_code: item.itemKey,
      ug: {
        itemKey: item.itemKey,
        supplierCode: String(item.supplierCode),
      },
    };
  });

  const ugResultsWithDeliveryDate = mappedResponseData.map((result) => {
    const deliveryDate = calculateDeliveryDate(result);
    return {
      ...result,
      deliveryDate,
    };
  });

  return ugResultsWithDeliveryDate;
};

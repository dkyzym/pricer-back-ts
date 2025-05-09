import { v4 as uuidv4 } from 'uuid';
import { Logger } from 'winston';
import {
  SearchResultsParsed,
  abcpArticleSearchResult,
} from '../../types/index.js';
import { calculateDeliveryDate } from '../../utils/calculateDates/index.js';
import { isBrandMatch } from '../../utils/data/isBrandMatch.js';

export const mapUgResponseData = (
  data: abcpArticleSearchResult[],
  brand: string,
  userLogger: Logger
): SearchResultsParsed[] => {
  const ownWarehouses = ['краснодар', 'ростов'];       // «родные» склады ЮГ

  const mappedResponseData: SearchResultsParsed[] = data.map((item) => {
    /** 1. Гарантируем, что строки не равны null/undefined */
    const supplierDescription = item.supplierDescription ?? '';
    const supplierDescriptionLower = supplierDescription.toLowerCase();

    /** 2. deliveryProbability тоже может отсутствовать */
    const probability =
      ownWarehouses.some((w) => supplierDescriptionLower.includes(w))
        ? 95
        : item.deliveryProbability ?? 0;

    return {
      id: uuidv4(),
      article: item.number,
      brand: item.brand,
      description: item.description,
      availability: item.availability,          // «под заказ» по умолчанию
      price: item.price,
      warehouse: supplierDescription,
      imageUrl: '',

      /** 3. Любое undefined → безопасное значение */
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

  /** 4. Сразу добавляем дату поставки */
  return mappedResponseData.map((result) => ({
    ...result,
    deliveryDate: calculateDeliveryDate(result, userLogger),
  }));
};

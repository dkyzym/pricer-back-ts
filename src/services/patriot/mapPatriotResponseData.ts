import { v4 as uuidv4 } from 'uuid';
import { Logger } from 'winston';
import {
    SearchResultsParsed,
    abcpArticleSearchResult,
} from '../../types/index.js';
import { calculateDeliveryDate } from '../../utils/calculateDates/index.js';
import { isBrandMatch } from '../../utils/data/isBrandMatch.js';

export const mapPatriotResponseData = (
  data: abcpArticleSearchResult[],
  brand: string,
  userLogger: Logger
): SearchResultsParsed[] => {
  const mappedResponseData: SearchResultsParsed[] = data.map((item) => {
       const probability = 95;

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
      supplier: 'patriot',
      probability,
      needToCheckBrand: !isBrandMatch(brand, item.brand),
      returnable: Number(!item.noReturn),
      multi: item.packing || 1,
      allow_return: !item.noReturn,
      warehouse_id: String(item.supplierCode),
      inner_product_code: item.itemKey,
      patriot: {
        itemKey: item.itemKey,
        supplierCode: String(item.supplierCode),
      },
    };
  });

  const patriotResultsWithDeliveryDate = mappedResponseData.map((result) => {
    const deliveryDate = calculateDeliveryDate(result, userLogger);
    console.log("deliveryDate",deliveryDate);
    return {
      ...result,
      deliveryDate,
    };
  });

  return patriotResultsWithDeliveryDate;
};

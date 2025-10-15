import { v4 as uuidv4 } from 'uuid';
import { Logger } from 'winston';
import {
  SearchResultsParsed,
  abcpArticleSearchResult,
} from '../../types/index.js';
import { calculateDeliveryDate } from '../../utils/calculateDates/calculateDeliveryDate.js';
import { isRelevantBrand } from '../../utils/isRelevantBrand.js';

export const mapAvtodinamikaResponseData = (
  data: abcpArticleSearchResult[],
  brand: string,
  userLogger: Logger,
  supplier: 'avtodinamika'
): SearchResultsParsed[] => {
  const mappedResponseData: SearchResultsParsed[] = data.map((item) => {
    const countedWarehouse = item.deliveryPeriod === 0 ? 'СВОЙ' : 'ЧУЖОЙ СКЛАД';

    return {
      id: uuidv4(),
      article: item.number,
      brand: item.brand,
      description: item.description,
      availability: item.availability,
      price: item.price,
      warehouse: countedWarehouse,
      imageUrl: '',

      deadline: item.deliveryPeriod || 1,
      deadLineMax: item.deliveryPeriodMax || 1,

      supplier,
      probability: item.deliveryProbability,
      needToCheckBrand: !isRelevantBrand(brand, item.brand),
      returnable: Number(!item.noReturn),
      multi: item.packing || 1,
      allow_return: !item.noReturn,
      warehouse_id: String(item.supplierCode),
      inner_product_code: item.itemKey,

      [supplier]: {
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

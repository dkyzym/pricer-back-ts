import { v4 as uuidv4 } from 'uuid';
import { Logger } from 'winston';
import {
  SearchResultsParsed,
  abcpArticleSearchResult,
} from '../../types/index.js';
import { calculateDeliveryDate } from '../../utils/calculateDates/calculateDeliveryDate.js';
import { isRelevantBrand } from '../../utils/isRelevantBrand.js';

export const mapPatriotResponseData = (
  data: abcpArticleSearchResult[],
  brand: string,
  userLogger: Logger,
  supplier: 'patriot'
): SearchResultsParsed[] => {
  const mappedResponseData: Omit<SearchResultsParsed, 'deliveryDate'>[] =
    data.map((item) => {
      let deadlines = {
        deadline: item.deliveryPeriod || 24,
        deadLineMax: item.deliveryPeriodMax || item.deliveryPeriod || 24,
      };

      return {
        id: uuidv4(),
        article: item.number,
        brand: item.brand,
        description: item.description,
        availability: item.availability,
        price: item.price,
        warehouse: item.supplierDescription,
        imageUrl: '',
        deadline: deadlines.deadline,
        deadLineMax: deadlines.deadLineMax,
        // Важно: передаем оригинальное поле, оно может понадобиться
        deadlineReplace: item.deadlineReplace,
        supplier: supplier,
        probability: 95,
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

  const resultsWithFinalDeliveryDate = mappedResponseData.map((result) => {
    // calculateDeliveryDate теперь использует часы и применяет финальную логику из конфига
    const deliveryDate = calculateDeliveryDate(
      result as SearchResultsParsed,
      userLogger
    );

    return {
      ...result,
      deliveryDate,
    };
  });

  return resultsWithFinalDeliveryDate;
};

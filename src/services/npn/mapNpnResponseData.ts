import { v4 as uuidv4 } from 'uuid';
import { Logger } from 'winston';
import {
  SearchResultsParsed,
  abcpArticleSearchResult,
} from '../../types/index.js';
import { calculateDeliveryDate } from '../../utils/calculateDates/calculateDeliveryDate.js';

import { isRelevantBrand } from '../../utils/data/brand/isRelevantBrand.js';
import { calculateNpnDeadlineHours } from '../../utils/npn/calculateNpnDeadline.js';

export const mapNpnResponseData = (
  data: abcpArticleSearchResult[],
  brand: string,
  userLogger: Logger,
  supplier: 'npn'
): SearchResultsParsed[] => {
  const mappedResponseData: Omit<SearchResultsParsed, 'deliveryDate'>[] =
    data.map((item) => {
      let deadlines = calculateNpnDeadlineHours(item, userLogger);

      const probability =
        item.deliveryProbability > 0 ? item.deliveryProbability : 95;

      const warehouse =
        item.deadlineReplace === ''
          ? 'СВОЙ СКЛАД'
          : `ЧУЖОЙ СКЛАД ${item.deadlineReplace}`;

      return {
        id: uuidv4(),
        article: item.number,
        brand: item.brand,
        description: item.description,
        availability: item.availability,
        price: item.price,
        warehouse: warehouse,
        imageUrl: '',
        deadline: deadlines.deadline,
        deadLineMax: deadlines.deadLineMax,
        deadlineReplace: item.deadlineReplace,
        supplier: supplier,
        probability,
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

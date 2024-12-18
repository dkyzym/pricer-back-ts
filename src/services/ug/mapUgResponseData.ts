import { v4 as uuidv4 } from 'uuid';
import { SearchResultsParsed, ugArticleSearchResult } from '../../types';
import { calculateDeliveryDate } from '../../utils/calculateDates';
import { isBrandMatch } from '../../utils/data/isBrandMatch';

export const mapUgResponseData = (
  data: ugArticleSearchResult[],
  brand: string
): SearchResultsParsed[] => {
  const mappedResponseData: SearchResultsParsed[] = data.map((item) => ({
    id: uuidv4(),
    article: item.number,
    brand: item.brand,
    description: item.description,
    availability: item.availability, //отрицательные значения -1, -2 и -3 означают "неточное" наличие, которое на сайте выглядит как "+", "++" и "+++" соответственно. Отрицательное значение -10 означает наличие "под заказ".
    price: item.price,
    warehouse: item.supplierDescription,
    imageUrl: '',
    deadline: item.deliveryPeriod || 1,
    deadLineMax: item.deliveryPeriodMax || 1,
    supplier: 'ug',
    probability: item.deliveryProbability,
    needToCheckBrand: !isBrandMatch(brand, item.brand),
    returnable: Number(!item.noReturn),
    multi: item.packing || 1,
    allow_return: String(!item.noReturn),
    warehouse_id: String(item.supplierCode), //supplierCode
    inner_product_code: item.itemKey, //itemKey
  }));

  const ugResultsWithDeliveryDate = mappedResponseData.map((result) => {
    const deliveryDate = calculateDeliveryDate(result);
    return {
      ...result,
      deliveryDate,
    };
  });

  return ugResultsWithDeliveryDate;
};

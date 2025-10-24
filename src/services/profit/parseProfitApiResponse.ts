
import { Logger } from 'winston';
import { SupplierName } from '../../types/common.types.js';
import { SearchResultsParsed } from '../../types/search.types.js';
import { calculateDeliveryDate } from '../../utils/calculateDates/calculateDeliveryDate.js';
import { needToCheckBrand } from '../../utils/data/brand/needToCheckBrand.js';
import { ApiResponseItem, ProductProfit } from './profit.types.js';

const getImageUrl = (product: ProductProfit): string => {
  return product.imageUrl || 'default-image-url.jpg';
};

export const parseProfitApiResponse = (
  apiResponse: ApiResponseItem[],
  expectedBrand: string,
  userLogger: Logger
): SearchResultsParsed[] => {
  const parsedResults: SearchResultsParsed[] = [];

  apiResponse.forEach((item) => {
    const { id: innerId, article, brand, products } = item;

    Object.entries(products).forEach(([productKey, product]) => {
      const parseProbability = (prob: number | undefined): number | '' => {
        return typeof prob === 'number' ? prob : '';
      };

      // Изменение здесь: извлечение чистого числа из product.quantity
      const availability =
        Number(String(product.quantity).replace(/[^\d.]/g, '')) || 0;

      const price = product.price;
      const warehouse = product.custom_warehouse_name;
      const imageUrl = getImageUrl(product);
      const deadline = product.delivery_time;
      const description = product.description;
      const deadLineMax = deadline;
      const supplier: SupplierName = 'profit';
      const probability = parseProbability(product.delivery_probability);
      const needToCheckBrandRes = needToCheckBrand(
        expectedBrand,
        product.brand
      );
      const returnable = product.returnable; // number
      const multi = product.multi; // number
      const allow_return = Boolean(product.allow_return); // string
      const warehouse_id = product.warehouse_id; // number
      const inner_product_code = product.product_code;

      // Извлекаем дату доставки
      const deliveryDateFromApi = product.delivery_date?.split(' ')[0] ?? '';

      // Создаём объект результата без даты доставки
      const parsedItem: SearchResultsParsed = {
        id: productKey,
        innerId,
        article,
        brand,
        description,
        availability,
        price,
        warehouse,
        imageUrl,
        deadline,
        deadLineMax,
        supplier,
        probability,
        needToCheckBrand: needToCheckBrandRes,
        deliveryDate: '', // Дата доставки будет рассчитана ниже
        returnable,
        multi,
        allow_return,
        warehouse_id,
        inner_product_code,
      };

      // Устанавливаем дату доставки, полученную из API
      parsedItem.deliveryDate = deliveryDateFromApi;

      // Вызываем функцию расчета даты доставки
      parsedItem.deliveryDate = calculateDeliveryDate(parsedItem, userLogger);

      parsedResults.push(parsedItem);
    });
  });

  return parsedResults;
};

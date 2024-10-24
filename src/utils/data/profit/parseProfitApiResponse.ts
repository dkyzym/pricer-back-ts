import { DateTime } from 'luxon';
import {
  ApiResponseItem,
  ProductProfit,
  SearchResultsParsed,
  SupplierName,
} from 'types';
import { calculateDeliveryDate } from '../../calculateDates';
import { needToCheckBrand } from '../needToCheckBrand';

const getImageUrl = (product: ProductProfit): string => {
  return product.imageUrl || 'default-image-url.jpg';
};

export const parseProfitApiResponse = (
  apiResponse: ApiResponseItem[],
  expectedBrand: string
): SearchResultsParsed[] => {
  const parsedResults: SearchResultsParsed[] = [];

  // Получаем текущее время
  const currentTime = DateTime.now().setZone('UTC+3');

  apiResponse.forEach((item) => {
    const { id: innerId, article, brand, products } = item;

    Object.entries(products).forEach(([productKey, product]) => {
      const parseProbability = (prob: number | undefined): number | '' => {
        return typeof prob === 'number' ? prob : '';
      };

      const availability = product.quantity;
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
      const allow_return = product.allow_return; //string
      const warehouse_id = product.warehouse_id; // number
      const inner_product_code = product.product_code;

      // Извлекаем дату доставки
      const deliveryDateFromApi = product.delivery_date?.split(' ')[0] ?? '';

      // Создаем объект результата без даты доставки
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
      parsedItem.deliveryDate = calculateDeliveryDate(parsedItem);

      parsedResults.push(parsedItem);
    });
  });

  return parsedResults;
};

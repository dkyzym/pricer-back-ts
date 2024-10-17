import {
  ApiResponseItem,
  ProductProfit,
  SearchResultsParsed,
  SupplierName,
} from 'types';
import { needToCheckBrand } from '../needToCheckBrand';

const getImageUrl = (product: ProductProfit): string => {
  return product.imageUrl || 'default-image-url.jpg';
};

export const parseApiResponse = (
  apiResponse: ApiResponseItem[],
  expectedBrand: string
): SearchResultsParsed[] => {
  const parsedResults: SearchResultsParsed[] = [];

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
      const deliveryDate = product.delivery_date.split(' ')[0]; // yyyy-mm-dd

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
        deliveryDate,
      };

      parsedResults.push(parsedItem);
    });
  });

  return parsedResults;
};

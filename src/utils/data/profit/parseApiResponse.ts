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

// [
//   {
//     id: '54479',
//     article: 'SP1165',
//     description: 'Колодки тормозные ВАЗ 2108-099 перед.',
//     brand: 'HI-Q',
//     original: '0',
//     brand_warranty: '0',
//     products: {
//       '878202cb3d160d368c1ffda4cc7483b8': {
//         donkey: 'ae15e41cbe2460d40771d890cb931b2f',
//         warehouse_id: '1799',
//         brand_id: 2996,
//         brand: 'HI-Q',
//         article: 'SP1165',
//         product_code: '1eaadb093ac2d5b5dd760a7b7eccd8d6',
//         multi: 1,
//         quantity: '>100',
//         price: 813.05,
//         returnable: -1,
//         description: 'Колодка передняя SANGSIN ВАЗ 2108-2115',
//         article_id: '54479',
//         return_days: 14,
//         brand_info: true,
//         brand_warranty: false,
//         original: false,
//         waitings: 0,
//         custom_warehouse_name: 'Москва-AB3',
//         show_date: '33 ч.',
//         delivery_time: 33,
//         allow_return: '1',
//         delivery_date: '2024-09-27 08:30:00',
//         delivery_probability: 92.41,
//       },
//       someElseItemID: {
//         // ...
//       },
//     },
//   },
// ];
export const parseApiResponse = (
  apiResponse: ApiResponseItem[],
  expectedBrand: string
): SearchResultsParsed[] => {
  const parsedResults: SearchResultsParsed[] = [];

  apiResponse.forEach((item) => {
    const { id: innerId, article, brand, products } = item;

    Object.entries(products).forEach(([productKey, product]) => {
      //   const parseAvailability = (quantity: string): number | string => {
      //     if (quantity.startsWith('>')) {
      //       return quantity;
      //     }
      //     const parsed = Number(quantity);
      //     return isNaN(parsed) ? quantity : parsed;
      //   };

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
      };

      parsedResults.push(parsedItem);
    });
  });

  return parsedResults;
};

// import { DateTime } from 'luxon';
// import { getAutosputnikItemsListByArticleService } from 'services/autosputnik/getItemsListByArticleService.js';
// import { v4 as uuidV4 } from 'uuid';
// import { Logger } from 'winston';
// import { SearchResultsParsed } from '../../types/search.types.js';
// import { calculateDeliveryDate } from '../../utils/calculateDates/calculateDeliveryDate.js';
// import { isRelevantBrand } from '../../utils/data/brand/isRelevantBrand.js';
// import { transformArticleByBrand } from '../../utils/data/brand/transformArticleByBrand.js';
// import { TovarAutosputnik } from './autosputnik.types.js';

// export const parseAutosputnikData = async (
//   item: {
//     article: string;
//     brand: string;
//   },
//   userLogger: Logger,
//   supplier: 'autosputnik' | 'autosputnik_bn'
// ) => {
//   try {
//     const articleToSearch = transformArticleByBrand(
//       item.article,
//       item.brand,
//       supplier
//     );

//     // Шаг 1: Получаем первоначальные данные без указания бренда
//     const initialData = await getAutosputnikItemsListByArticleService(
//       articleToSearch,
//       userLogger,
//       supplier
//     );

//     // Извлекаем массив объектов из initialData.requestAnswer
//     const responseArray = initialData.requestAnswer;

//     if (!Array.isArray(responseArray)) {
//       throw new Error('Invalid response format: requestAnswer is not an array');
//     }

//     // Шаг 2: Фильтруем бренды с помощью isBrandMatch
//     const relevantBrandIds = responseArray
//       .filter((responseItem: any) =>
//         isRelevantBrand(item.brand, responseItem.BRA_BRAND)
//       )
//       .map((responseItem: any) => responseItem.BRA_ID);

//     // Убираем дубликаты идентификаторов брендов
//     const uniqueBrandIds = Array.from(new Set(relevantBrandIds));

//     // Шаг 3: Делаем повторные запросы с каждым идентификатором бренда
//     const promises = uniqueBrandIds.map((brandId: string) =>
//       getAutosputnikItemsListByArticleService(
//         articleToSearch,
//         userLogger,
//         supplier,
//         brandId
//       )
//     );

//     // Ожидаем завершения всех промисов
//     const results = await Promise.allSettled(promises);

//     // Собираем успешные результаты
//     const fulfilledResults = results
//       .filter((result) => result.status === 'fulfilled')
//       .map((result) => (result as PromiseFulfilledResult<any>).value);

//     // Шаг 4: Объединяем данные
//     const combinedData = fulfilledResults.reduce(
//       (acc: TovarAutosputnik[], data: any) => {
//         if (data.requestAnswer && Array.isArray(data.requestAnswer)) {
//           acc.push(...data.requestAnswer);
//         }
//         return acc;
//       },
//       []
//     );

//     const mapAutosputnikData: SearchResultsParsed[] = combinedData.map(
//       (item) => {
//         const newItem = {
//           id: uuidV4(),
//           article: item.ARTICUL,
//           availability: item.STOCK,
//           brand: item.BRA_BRAND,
//           price: Number(item.NEW_COST),
//           allow_return: item.RETURNS_POSIBL === '1' ? true : false,
//           supplier,
//           warehouse: item.PRICE_NAME,
//           imageUrl: '',
//           deliveryDate: DateTime.fromFormat(
//             item.DAYOFF2,
//             'yyyy-MM-dd HH:mm:ss'
//           ).toFormat('yyyy-MM-dd'),

//           multi: Number(item.CRATN),
//           probability:
//             Number(item.SHIPPING_PROC) === 0 ? 80 : Number(item.SHIPPING_PROC),
//           warehouse_id: item.ID_SHOP_PRICES,
//           description: item.NAME_TOVAR,
//           [supplier]: {
//             brand: item.BRA_ID,
//             id_shop_prices: item.ID_SHOP_PRICES,
//           },
//           deadline: Number(item.DAYOFF) * 24,
//           deadLineMax: Number(item.DAYOFF) * 24,
//         };

//         return {
//           ...newItem,
//           deliveryDate: calculateDeliveryDate(newItem, userLogger),
//         };
//       }
//     );

//     return mapAutosputnikData;
//   } catch (error) {
//     userLogger.error('Error in parseAutosputnikData:', error);
//     throw error;
//   }
// };

// services/autosputnik/parseAutosputnikData.ts
// services/autosputnik/parseAutosputnikData.ts
import { DateTime } from 'luxon';
import { v4 as uuidV4 } from 'uuid';
import { Logger } from 'winston';
import { SearchResultsParsed } from '../../types/search.types.js';
import { calculateDeliveryDate } from '../../utils/calculateDates/calculateDeliveryDate.js';
import { isRelevantBrand } from '../../utils/data/brand/isRelevantBrand.js';
import { transformArticleByBrand } from '../../utils/data/brand/transformArticleByBrand.js';
import { AutosputnikProductItem } from './autosputnik.types.js';
import {
  getAutosputnikBrands,
  getAutosputnikProducts,
} from './autosputnikApi.js';

/**
 * Расчет вероятности на основе флагов API
 */
function calculateProbability(item: AutosputnikProductItem): number {
  if (item.our) return 95; // Собственный склад
  if (item.official_diler) return 90; // Официальный дилер
  return 80; // Обычный поставщик
}

export const parseAutosputnikData = async (
  item: {
    article: string;
    brand: string;
  },
  userLogger: Logger,
  supplier: 'autosputnik' | 'autosputnik_bn'
) => {
  try {
    const articleToSearch = transformArticleByBrand(
      item.article,
      item.brand,
      supplier
    );

    // 1. Получаем бренды
    const brandsResponse = await getAutosputnikBrands(
      articleToSearch,
      userLogger,
      supplier
    );

    if (
      brandsResponse.error ||
      !Array.isArray(brandsResponse.data) ||
      brandsResponse.data.length === 0
    ) {
      return [];
    }

    // 2. Фильтруем (собираем имена брендов для запроса)
    const uniqueBrandNames = new Set<string>();

    brandsResponse.data.forEach((brandItem) => {
      const apiBrandName = brandItem.brand.name;
      if (isRelevantBrand(item.brand, apiBrandName)) {
        uniqueBrandNames.add(apiBrandName);
      }
    });

    if (uniqueBrandNames.size === 0) {
      return [];
    }

    // 3. Запрашиваем цены (параллельно по каждому бренду)
    const promises = Array.from(uniqueBrandNames).map((brandName) =>
      getAutosputnikProducts(articleToSearch, brandName, userLogger, supplier)
    );

    const results = await Promise.allSettled(promises);

    const allProducts: AutosputnikProductItem[] = [];
    console.log(results);
    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        const payload = result.value;
        if (!payload.error && Array.isArray(payload.data)) {
          allProducts.push(...payload.data);
        }
      }
    });

    // 4. Преобразуем в наш формат
    const parsedResults: SearchResultsParsed[] = allProducts.map((prod) => {
      const deliveryDt = DateTime.fromISO(prod.delivery_date);

      const newItem: any = {
        id: uuidV4(),
        article: prod.articul,
        availability: String(prod.quantity),
        brand: prod.brand.name,
        price: Number(prod.price),
        allow_return: prod.vozvrat,
        supplier,
        warehouse: prod.price_name || 'Autosputnik',
        imageUrl: '',

        // Дата доставки
        deliveryDate: deliveryDt.isValid
          ? deliveryDt.toFormat('yyyy-MM-dd')
          : '',

        multi: Number(prod.cratnost),

        // Новая логика вероятности
        probability: calculateProbability(prod),

        warehouse_id: String(prod.id_shop_prices),
        description: prod.name,
        [supplier]: {
          brand: String(prod.brand.id),
          id_shop_prices: String(prod.id_shop_prices),
        },
        deadline: Number(prod.delivery_day) * 24,
        deadLineMax: Number(prod.delivery_day) * 24,
      };

      return {
        ...newItem,
        deliveryDate: calculateDeliveryDate(newItem, userLogger),
      };
    });

    return parsedResults;
  } catch (error) {
    userLogger.error('Error in parseAutosputnikData:', error);
    throw error;
  }
};

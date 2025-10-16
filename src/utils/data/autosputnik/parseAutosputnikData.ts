import { DateTime } from 'luxon';
import { getAutosputnikItemsListByArticleService } from 'services/autosputnik/getItemsListByArticleService.js';
import { v4 as uuidV4 } from 'uuid';
import { Logger } from 'winston';
import { SearchResultsParsed, TovarAutosputnik } from '../../../types/index.js';
import { calculateDeliveryDate } from '../../calculateDates/calculateDeliveryDate.js';
import { isRelevantBrand } from '../../isRelevantBrand.js';

export const parseAutosputnikData = async (
  item: {
    article: string;
    brand: string;
  },
  userLogger: Logger,
  supplier: 'autosputnik' | 'autosputnik_bn'
) => {
  try {
    // Шаг 1: Получаем первоначальные данные без указания бренда
    const initialData = await getAutosputnikItemsListByArticleService(
      item.article,
      userLogger,
      supplier
    );

    // Извлекаем массив объектов из initialData.requestAnswer
    const responseArray = initialData.requestAnswer;

    if (!Array.isArray(responseArray)) {
      throw new Error('Invalid response format: requestAnswer is not an array');
    }

    // Шаг 2: Фильтруем бренды с помощью isBrandMatch
    const relevantBrandIds = responseArray
      .filter((responseItem: any) =>
        isRelevantBrand(item.brand, responseItem.BRA_BRAND)
      )
      .map((responseItem: any) => responseItem.BRA_ID);

    // Убираем дубликаты идентификаторов брендов
    const uniqueBrandIds = Array.from(new Set(relevantBrandIds));

    // Шаг 3: Делаем повторные запросы с каждым идентификатором бренда
    const promises = uniqueBrandIds.map((brandId: string) =>
      getAutosputnikItemsListByArticleService(
        item.article,
        userLogger,
        supplier,
        brandId
      )
    );

    // Ожидаем завершения всех промисов
    const results = await Promise.allSettled(promises);

    // Собираем успешные результаты
    const fulfilledResults = results
      .filter((result) => result.status === 'fulfilled')
      .map((result) => (result as PromiseFulfilledResult<any>).value);

    // Шаг 4: Объединяем данные
    const combinedData = fulfilledResults.reduce(
      (acc: TovarAutosputnik[], data: any) => {
        if (data.requestAnswer && Array.isArray(data.requestAnswer)) {
          acc.push(...data.requestAnswer);
        }
        return acc;
      },
      []
    );

    const mapAutosputnikData: SearchResultsParsed[] = combinedData.map(
      (item) => {
        const newItem = {
          id: uuidV4(),
          article: item.ARTICUL,
          availability: item.STOCK,
          brand: item.BRA_BRAND,
          price: Number(item.NEW_COST),
          allow_return: item.RETURNS_POSIBL === '1' ? true : false,
          supplier,
          warehouse: item.PRICE_NAME,
          imageUrl: '',
          deliveryDate: DateTime.fromFormat(
            item.DAYOFF2,
            'yyyy-MM-dd HH:mm:ss'
          ).toFormat('yyyy-MM-dd'),

          multi: Number(item.CRATN),
          probability:
            Number(item.SHIPPING_PROC) === 0 ? 80 : Number(item.SHIPPING_PROC),
          warehouse_id: item.ID_SHOP_PRICES,
          description: item.NAME_TOVAR,
          [supplier]: {
            brand: item.BRA_ID,
            id_shop_prices: item.ID_SHOP_PRICES,
          },
          deadline: Number(item.DAYOFF) * 24,
          deadLineMax: Number(item.DAYOFF) * 24,
        };

        return {
          ...newItem,
          deliveryDate: calculateDeliveryDate(newItem, userLogger),
        };
      }
    );

    return mapAutosputnikData;
  } catch (error) {
    userLogger.error('Error in parseAutosputnikData:', error);
    throw error;
  }
};

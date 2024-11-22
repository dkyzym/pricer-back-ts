import { getAutosputnikItemsListByArticleService } from 'services/autosputnik/getItemsListByArticleService';
import { isBrandMatch } from '../isBrandMatch';

export const parseAutosputnikData = async (item: {
  article: string;
  brand: string;
}) => {
  try {
    // Шаг 1: Получаем первоначальные данные без указания бренда
    const initialData = await getAutosputnikItemsListByArticleService(
      item.article
    );

    // Извлекаем массив объектов из initialData.requestAnswer
    const responseArray = initialData.requestAnswer;

    if (!Array.isArray(responseArray)) {
      throw new Error('Invalid response format: requestAnswer is not an array');
    }

    // Шаг 2: Фильтруем бренды с помощью isBrandMatch
    const relevantBrandIds = responseArray
      .filter((responseItem: any) =>
        isBrandMatch(item.brand, responseItem.BRA_BRAND)
      )
      .map((responseItem: any) => responseItem.BRA_ID);

    // Убираем дубликаты идентификаторов брендов
    const uniqueBrandIds = Array.from(new Set(relevantBrandIds));

    // Шаг 3: Делаем повторные запросы с каждым идентификатором бренда
    const promises = uniqueBrandIds.map((brandId: string) =>
      getAutosputnikItemsListByArticleService(item.article, brandId)
    );

    // Ожидаем завершения всех промисов
    const results = await Promise.allSettled(promises);

    // Собираем успешные результаты
    const fulfilledResults = results
      .filter((result) => result.status === 'fulfilled')
      .map((result) => (result as PromiseFulfilledResult<any>).value);

    // Шаг 4: Объединяем данные
    const combinedData = fulfilledResults.reduce((acc: any[], data: any) => {
      if (data.requestAnswer && Array.isArray(data.requestAnswer)) {
        acc.push(...data.requestAnswer);
      }
      return acc;
    }, []);

    // Возвращаем объединенные данные
    return combinedData;
  } catch (error) {
    console.error('Error in parseAutosputnikData:', error);
    throw error;
  }
};

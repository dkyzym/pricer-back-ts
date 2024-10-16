// import { logger } from 'logger';
import { logger } from 'config/logger';
import {
  ItemToParallelSearch,
  ParallelSearchParams,
  SearchResultsParsed,
  SupplierName,
} from 'types';

export const parsePickedPatriotResults = async ({
  page,
  item,
  supplier,
}: ParallelSearchParams): Promise<SearchResultsParsed[]> => {
  try {
    await page.waitForSelector('.searchResultsTableWrapper', {
      timeout: 30000,
    });

    const results = await page.evaluate(
      (item: ItemToParallelSearch, supplier: SupplierName) => {
        try {
          // Проверяем валидность данных item
          if (!item || !item.brand || !item.article) {
            logger.error(`${page.url()} Invalid item data: ${item}`);
            return [];
          }

          // Удаляем не буквенные символы из бренда
          const brandWithoutGaps = item.brand.replace(/[^\p{L}]/gu, '');

          // Формируем dataContent и селектор строки
          const dataContent = `${encodeURIComponent(item.article)}_${encodeURIComponent(brandWithoutGaps)}`;

          const itemRowSelector = `tr[data-current-brand-number="${dataContent}" i]`;

          // Ищем строки с товарами
          const itemRows =
            document.querySelectorAll<HTMLTableRowElement>(itemRowSelector);

          if (itemRows.length === 0) {
            logger.warn(
              `${page.url()} No item rows found with the given selector.`
            );
            return [];
          }

          // Фильтруем строки по наличию 'Луганск' в тексте
          const closestWarehouseItemRows = Array.from(itemRows).filter(
            (row) => {
              const textContent = row.textContent?.trim();
              return textContent?.includes('Луганск');
            }
          );

          if (closestWarehouseItemRows.length === 0) {
            return [];
          }

          // Парсим данные из строк
          const data: SearchResultsParsed[] = closestWarehouseItemRows
            .map((row, index) => {
              // Получаем элементы внутри строки
              const fakeInputElement = row.querySelector<HTMLInputElement>(
                'input.addToBasketLinkFake'
              );
              const descriptionElement =
                row.querySelector<HTMLElement>('.resultDescription');
              const warehouseElement =
                row.querySelector<HTMLElement>('.resultWarehouse');
              const imageElement = row.querySelector<HTMLImageElement>(
                'img.searchResultImg'
              );

              if (!fakeInputElement) {
                logger.warn(
                  `${supplier} Row ${index}: fakeInputElement not found.`
                );
                return null; // Пропускаем строку, если элемент не найден
              }

              // Собираем данные продукта
              const product: SearchResultsParsed = {
                article: fakeInputElement.getAttribute('number') || '',
                availability: parseInt(
                  fakeInputElement.getAttribute('availability') || '0',
                  10
                ),
                brand: fakeInputElement.getAttribute('brand') || '',
                deadline: parseInt(
                  fakeInputElement.getAttribute('data-deadline') || '0',
                  10
                ),
                deadLineMax: parseInt(
                  fakeInputElement.getAttribute('data-deadline-max') || '0',
                  10
                ),
                description: descriptionElement?.innerText.trim() || '',
                id: fakeInputElement.getAttribute('searchresultuniqueid') || '',
                imageUrl: imageElement?.getAttribute('src') || '',
                price: parseFloat(row.getAttribute('data-output-price') || '0'),
                probability: 99,
                supplier,
                warehouse: warehouseElement?.innerText.trim() || '',
              };

              return product;
            })
            .filter((product) => product !== null) as SearchResultsParsed[];

          return data;
        } catch (evalError) {
          logger.error(`${supplier} Error inside page.evaluate: ${evalError}`);

          return [];
        }
      },
      item,
      supplier
    );

    return results;
  } catch (error) {
    logger.error(`${supplier} Error in parsePickedPatriotResults: ${error}`);

    return [];
  }
};

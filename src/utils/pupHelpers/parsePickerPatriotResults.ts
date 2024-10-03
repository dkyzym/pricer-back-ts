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
    // Убедимся, что страница полностью загрузилась
    await page.waitForNetworkIdle();

    // Настраиваем перехват console.log из контекста страницы
    page.on('console', (msg: any) => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'log') {
        console.log(`PAGE LOG: ${text}`);
      } else if (type === 'error') {
        console.error(`PAGE ERROR: ${text}`);
      }
    });

    // Выполняем код в контексте страницы
    const results = await page.evaluate(
      (item: ItemToParallelSearch, supplier: SupplierName) => {
        try {
          // Проверяем валидность данных item
          if (!item || !item.brand || !item.article) {
            console.error('Invalid item data:', item);
            return [];
          }

          // Удаляем не буквенные символы из бренда
          const brandWithoutGaps = item.brand.replace(/[^\p{L}]/gu, '');
          console.log('Brand without gaps:', brandWithoutGaps);

          // Формируем dataContent и селектор строки
          const dataContent = `${encodeURIComponent(item.article)}_${encodeURIComponent(brandWithoutGaps)}`;
          console.log('Data Content:', dataContent);

          const itemRowSelector = `tr[data-current-brand-number="${dataContent}" i]`;
          console.log('Item Row Selector:', itemRowSelector);

          // Ищем строки с товарами
          const itemRows =
            document.querySelectorAll<HTMLTableRowElement>(itemRowSelector);
          console.log('Number of item rows found:', itemRows.length);

          if (itemRows.length === 0) {
            console.warn('No item rows found with the given selector.');
            return [];
          }

          // Фильтруем строки по наличию 'Луганск' в тексте
          const closestWarehouseItemRows = Array.from(itemRows).filter(
            (row) => {
              const textContent = row.textContent?.trim();
              return textContent?.includes('Луганск');
            }
          );
          console.log(
            'Number of closest warehouse item rows:',
            closestWarehouseItemRows.length
          );

          if (closestWarehouseItemRows.length === 0) {
            console.warn('No rows found containing "Луганск".');
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
                console.warn(`Row ${index}: fakeInputElement not found.`);
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

              console.log(`Row ${index}: Parsed product data:`, product);

              return product;
            })
            .filter((product) => product !== null) as SearchResultsParsed[];

          console.log('Total products parsed:', data.length);
          return data;
        } catch (evalError) {
          console.error('Error inside page.evaluate:', evalError);
          return [];
        }
      },
      item,
      supplier
    );

    return results;
  } catch (error) {
    console.error(`Error in parsePickedPatriotResults: ${error}`);
    return [];
  }
};

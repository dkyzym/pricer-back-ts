import { Page } from 'puppeteer';
import { ParallelSearchParams, SearchResultsParsed } from 'types';
import { calculateDeliveryDate } from '../calculateDates';
import { filterEqualResults } from '../data/filterEqualResults';

// Функция для парсинга данных с страницы
export const parseData = async (
  page: Page
): Promise<Omit<SearchResultsParsed, 'supplier'>[]> => {
  return await page.evaluate(() => {
    // Выбираем все строки с результатами
    const rows = document.querySelectorAll('[class^="resultTr2"]');
    const data: Omit<SearchResultsParsed, 'supplier'>[] = [];

    rows.forEach((row) => {
      // Извлекаем элементы для каждого поля
      const articleElement = row.querySelector(
        '.resultPartCode a'
      ) as HTMLElement;
      const brandElement = row.querySelector('.resultBrand a') as HTMLElement;
      const descriptionElement = row.querySelector(
        '.resultDescription'
      ) as HTMLElement;
      const warehouseElement = row.querySelector(
        '.resultWarehouse'
      ) as HTMLElement;
      const imageElement = row.querySelector('.resultImage img');
      const probabilityElement = row.querySelector('.resultProbability');
      const quantityInputElement = row.querySelector('input.quantityInputFake');
      const addToBasketElement = row.querySelector('input.addToBasketLinkFake');
      const allowReturnElement = row.querySelector(
        '.fr-icon2-minus-circled.fr-text-danger'
      );

      // Получаем текст или атрибуты из элементов
      const article = articleElement?.innerText.trim() || '';
      const brand = brandElement?.innerText.trim() || '';
      const description = descriptionElement?.innerText.trim() || '';
      const warehouse = warehouseElement?.innerText.trim() || '';
      const imageUrl = imageElement?.getAttribute('src') || '';
      const probabilityText =
        probabilityElement?.textContent?.replace('%', '').trim() || '';
      const probability = parseFloat(probabilityText) || '';
      const id =
        quantityInputElement?.getAttribute('searchresultuniqueid') || '';
      const multiText = addToBasketElement?.getAttribute('packing') || '1';
      const multi = Number(multiText);

      // Определяем возможность возврата товара
      const allowReturnTitle = allowReturnElement?.getAttribute('title') || '';
      const allow_return = allowReturnTitle.includes(
        'не подлежит возврату или обмену'
      )
        ? '0'
        : '1';

      // Извлекаем атрибуты из элемента строки
      const availabilityText = row.getAttribute('data-availability') || '0';
      const priceText = row.getAttribute('data-output-price') || '0';
      const deadlineText = row.getAttribute('data-deadline') || '0';
      const deadLineMaxText = row.getAttribute('data-deadline-max') || '0';

      const availability = parseInt(availabilityText, 10) || 0;
      const price = parseFloat(priceText) || 0;
      const deadline = parseInt(deadlineText, 10) || 0;
      const deadLineMax = parseInt(deadLineMaxText, 10) || 0;

      // Формируем объект продукта
      const product: Omit<SearchResultsParsed, 'supplier'> = {
        article,
        brand,
        description,
        availability,
        price,
        warehouse,
        imageUrl,
        deadline,
        deadLineMax,
        probability,
        id,
        multi,
        allow_return,
      };

      data.push(product);
    });

    return data;
  });
};

// Функция для обработки и возврата  результатов поиска
export const parsePickedUgResults = async ({
  page,
  item,
  supplier,
}: ParallelSearchParams): Promise<SearchResultsParsed[]> => {
  // Ожидаем, пока результаты поиска загрузятся
  await page.waitForSelector('#searchInProgress', {
    hidden: true,
    timeout: 60000,
  });

  // Дополнительная задержка для гарантии полной загрузки данных
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Парсим данные со страницы
  const currentData = await parseData(page);

  if (currentData.length > 0) {
    // Добавляем информацию о поставщике к каждому продукту
    const resultsWithSupplier = currentData
      .map((product) => ({
        ...product,
        supplier,
      }))
      .filter((product) => product.warehouse !== 'Внешний склад');

    // Фильтруем результаты на основе заданных критериев
    const filteredResults = filterEqualResults(resultsWithSupplier, item);

    // Вычисляем дату доставки для каждого продукта
    const resultsWithDeliveryDate = filteredResults.map((result) => {
      const deliveryDate = calculateDeliveryDate(result);
      return {
        ...result,
        deliveryDate,
      };
    });

    return resultsWithDeliveryDate;
  }

  // Возвращаем пустой массив, если данных нет
  return [];
};

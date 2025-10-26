import * as cheerio from 'cheerio';
import { Logger } from 'winston'; // Убедись, что импорт Logger правильный
import { SupplierName } from '../types/common.types.js'; // Убедись, что пути к типам верны
import {
  ParallelSearchParams,
  SearchResultsParsed,
} from '../types/search.types.js';
import { calculateDeliveryDate } from './calculateDates/calculateDeliveryDate.js';
import { filterEqualResults } from './data/filterEqualResults.js';

// Обновленный интерфейс, включающий артикул, который реально искали
interface ParseParams extends ParallelSearchParams {
  html: string;
  userLogger: Logger;
  articleSearched: string; // Добавлено поле для корректной фильтрации
}

/**
 * Вспомогательная функция для парсинга HTML-таблицы результатов поиска ABCP.
 * Она ищет строки по селектору [class^="resultTr2"] и извлекает данные.
 * Адаптирована для работы как со страницей списка, так и с прямой страницей товара.
 */
export const parseData = async (
  $: cheerio.CheerioAPI,
  supplier: SupplierName,
  userLogger: Logger
): Promise<Omit<SearchResultsParsed, 'supplier'>[]> => {
  const data: Omit<SearchResultsParsed, 'supplier'>[] = [];

  // Ищем все строки таблицы с результатами
  const rows = $('[class^="resultTr2"]');

  rows.each((index, row) => {
    const $row = $(row);

    try {
      // --- Логика извлечения данных ---
      const articleElement = $row.find('.resultPartCode a');
      const article = articleElement.text().trim();
      const brandElement = $row.find('.resultBrand a');
      const brand = brandElement.length
        ? brandElement.text().trim()
        : $row.find('.resultBrand').text().trim(); // Запасной вариант, если ссылки нет
      const description = $row.find('.resultDescription').text().trim();

      const warehouseElement = $row.find('.resultWarehouse');
      const warehouse = warehouseElement.length
        ? warehouseElement.text().trim()
        : ''; // Пусто, если нет элемента

      const imageUrl = $row.find('.resultImage img').attr('src') || '';

      const probabilityElement = $row.find('.resultProbability');
      const probabilityText = probabilityElement.length
        ? probabilityElement.text().replace('%', '').trim()
        : '0'; // 0 по умолчанию
      const probability = parseFloat(probabilityText) || 0;

      const idElement = $row.find('input.quantityInputFake');
      const id = idElement.length
        ? idElement.attr('searchresultuniqueid') || ''
        : ''; // Пусто, если нет элемента

      const multiElement = $row.find('input.addToBasketLinkFake');
      const multiText = multiElement.length
        ? multiElement.attr('packing') || '1'
        : '1'; // 1 по умолчанию
      const multi = Number(multiText);

      const allowReturnElement = $row.find(
        '.fr-icon2-minus-circled.fr-text-danger'
      );
      const allowReturnTitle = allowReturnElement.length
        ? allowReturnElement.attr('title') || ''
        : '';
      const allow_return = !allowReturnTitle.includes(
        'не подлежит возврату или обмену'
      ); // true, если иконки нет или title другой

      // Data-атрибуты строки
      const availabilityText = $row.attr('data-availability') || '0';
      const priceText = $row.attr('data-output-price') || '0';

      // Адаптация срока поставки (может быть "На складе")
      const deadlineElement = $row.find('.resultDeadline');
      const deadlineTextRaw = deadlineElement.length
        ? deadlineElement.text().trim()
        : '';
      let deadline = 12; // Значение по умолчанию
      let deadLineMax = 24; // Значение по умолчанию
      if (deadlineTextRaw.toLowerCase() !== 'на складе') {
        deadline = parseInt($row.attr('data-deadline') || '12', 10);
        deadLineMax = parseInt(
          $row.attr('data-deadline-max') || String(deadline + 12), // Добавляем запас, если max нет
          10
        );
      } else {
        deadline = 0; // "На складе" = 0 часов
        deadLineMax = 0;
      }

      // Адаптация наличия (может быть "+")
      let availability: number | string = 0;
      if (supplier === 'mikano' && availabilityText === '-1') {
        availability = 50; // Специальное правило для mikano
      } else if ($row.find('.resultAvailability span').text().trim() === '+') {
        availability = '+'; // Оставляем как строку "+"
        // Либо: availability = 99; // Заменяем "+" на большое число
      } else {
        availability = parseInt(availabilityText, 10) || 0;
      }

      const price = parseFloat(priceText) || 0;

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

      // Добавляем, только если есть цена и артикул
      if (price > 0 && article) {
        data.push(product);
      }
    } catch (error) {
      userLogger.error(
        // Оставляем лог ошибки парсинга строки
        `[parseData] Error parsing row ${index}: ${(error as Error).message}`
      );
      // userLogger.error(`[parseData] Row HTML: ${$row.html()}`); // Можно раскомментировать для детального дебага
    }
  });

  return data;
};

/**
 * Основная функция для парсинга HTML ответа от поставщиков ABCP (парсеры).
 * Вызывает parseData для извлечения данных, затем добавляет поле supplier,
 * фильтрует результаты и рассчитывает дату доставки.
 */
export const parsePickedABCPresults = async ({
  html,
  item,
  supplier,
  userLogger,
  articleSearched, // Принимаем артикул, который искали
}: ParseParams): Promise<SearchResultsParsed[]> => {
  const $ = cheerio.load(html);

  // Вызываем parseData для извлечения данных
  const currentData = await parseData($, supplier, userLogger);

  if (currentData.length > 0) {
    // Добавляем поле supplier и корректируем probability для парсеров
    const resultsWithSupplier = currentData
      .map((product) => {
        if (supplier === 'autoImpulse' || supplier === 'mikano') {
          // Если probability не было (0), ставим 98. Иначе оставляем как есть.
          // Это делается, т.к. парсеры обычно более надежны, чем API без probability
          if (!product.probability) {
            product.probability = 98;
          }
        }
        return { ...product, supplier };
      })
      // Убираем предложения с "Внешнего склада", если они есть
      .filter((product) => product.warehouse !== 'Внешний склад');

    // Фильтруем результаты, сравнивая с ОРИГИНАЛЬНЫМ брендом
    // и АРТИКУЛОМ, КОТОРЫЙ ИСКАЛИ (articleSearched)
    const filteredResults = filterEqualResults(
      resultsWithSupplier,
      item, // Передаем оригинальный item для сравнения бренда
      articleSearched // Передаем articleSearched для сравнения артикула
    );

    // Рассчитываем дату доставки для отфильтрованных результатов
    const resultsWithDeliveryDate = filteredResults.map((result) => ({
      ...result,
      deliveryDate: calculateDeliveryDate(result, userLogger),
    }));

    return resultsWithDeliveryDate;
  }

  // Если parseData ничего не нашел
  return [];
};

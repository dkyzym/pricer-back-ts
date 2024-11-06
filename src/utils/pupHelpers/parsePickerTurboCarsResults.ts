import { logger } from 'config/logger';
import { ElementHandle, Page } from 'puppeteer';
import {
  ItemToParallelSearch,
  ParallelSearchParams,
  SearchResultsParsed,
} from 'types';
import { v4 as uuidv4 } from 'uuid';
import { calculateDeliveryDate } from '../calculateDates';
import { isBrandMatch } from '../data/isBrandMatch';
import { needToCheckBrand } from '../data/needToCheckBrand';

// Функция для проверки видимости элемента
const isElementVisible = async (
  page: Page,
  element: ElementHandle<Element>
): Promise<boolean> => {
  return await page.evaluate((el) => {
    const style = window.getComputedStyle(el);
    return (
      style &&
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      (el as HTMLElement).offsetHeight > 0 &&
      (el as HTMLElement).offsetWidth > 0
    );
  }, element);
};

// Функция для нормализации названий брендов
const normalizeBrandNameExtended = (
  brand: string | null | undefined
): string[] => {
  if (!brand) {
    return [];
  }
  const normalized = brand.replace(/\s+/g, '').toLowerCase();
  const parts = normalized
    .split(/[()]/)
    .filter(Boolean)
    .map((part) => part.trim());
  return parts.length > 1 ? [normalized, ...parts] : [normalized];
};

export const isInStock = async (
  page: Page,
  item: ItemToParallelSearch
): Promise<boolean> => {
  logger.info(`Проверка наличия товара: ${item.article}, бренд: ${item.brand}`);

  const firstRowSelector = '#block0';

  // Декодируем и нормализуем название бренда
  const decodedBrand = item.brand ? decodeURIComponent(item.brand) : '';
  const brandVariants = normalizeBrandNameExtended(decodedBrand);
  logger.debug(`Варианты бренда: ${JSON.stringify(brandVariants)}`);

  // Находим родительский элемент и проверяем, видим ли он
  const parentElementHandle = await page.$(firstRowSelector);
  if (
    !parentElementHandle ||
    !(await isElementVisible(page, parentElementHandle))
  ) {
    logger.warn(
      `Родительский элемент не найден или не виден для товара: ${item.article}`
    );
    return false;
  }

  // Находим все элементы <tr> внутри родительского элемента
  const trHandles = await parentElementHandle.$$(':scope > tr');

  let inStock = false;

  for (const trHandle of trHandles) {
    try {
      // Проверяем, содержит ли список классов или текстовое содержимое название бренда
      const { classList, textContent } = await page.evaluate(
        (el) => ({
          classList: Array.from(el.classList),
          textContent: el.textContent || '',
        }),
        trHandle
      );

      const normalizedClassList = classList.map((cls) =>
        cls.replace(/\s+/g, '').toLowerCase()
      );

      const hasMatchingClass = normalizedClassList.some((cls) =>
        brandVariants.some((variant) => isBrandMatch(variant, cls))
      );

      const textParts = textContent
        .toLowerCase()
        .split(/[()]/)
        .filter(Boolean)
        .map((part) => part.trim());
      const hasMatchingTextContent = textParts.some((part) =>
        brandVariants.some((variant) => isBrandMatch(variant, part))
      );

      if (
        (hasMatchingClass || hasMatchingTextContent) &&
        (await isElementVisible(page, trHandle))
      ) {
        logger.info(`Товар ${item.article} в наличии`);
        inStock = true;
        break;
      }
    } catch (error) {
      logger.error(
        `Ошибка при проверке наличия товара ${item.article}: ${error}`
      );
    } finally {
      // Освобождаем ресурсы
      await trHandle.dispose();
    }
  }

  // Освобождаем родительский элемент
  await parentElementHandle.dispose();

  if (!inStock) {
    logger.info(`Товар ${item.article} не в наличии`);
  }

  return inStock;
};

export const parsePickedTurboCarsResults = async ({
  page,
  item,
  supplier,
}: ParallelSearchParams): Promise<SearchResultsParsed[]> => {
  logger.info(
    `Парсинг результатов для товара: ${item.article}, поставщик: ${supplier}`
  );
  await page.waitForSelector('#codeinfo', { visible: true, timeout: 60_000 });

  const brand = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('tr'));
    const producerRow = rows.find((row) =>
      row.textContent?.includes('Производитель/поставщик')
    );
    return producerRow
      ? producerRow.querySelector('a')?.textContent?.trim() || ''
      : '';
  });

  const description = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('tr'));
    const nameRow = rows.find((row) =>
      row.textContent?.includes('Наименование')
    );
    return nameRow
      ? nameRow.querySelector('td[colspan="4"]')?.textContent?.trim() || ''
      : '';
  });

  logger.debug(`Получены бренд: ${brand}, описание: ${description}`);

  const results = await page.$$eval(
    'table.noborder.ss tr.aaa',
    (rows: HTMLTableRowElement[], brand: string) => {
      return rows
        .map((row) => {
          try {
            const tds = row.querySelectorAll('td');

            if (tds.length < 2) return null;

            const firstTdText = tds[0].innerText.trim();
            const [warehouseRaw, ...deadlineParts] = firstTdText.split(' ');
            const warehouse = warehouseRaw;
            let deadline = 0;
            let deadLineTimeToOrder = '';

            const deadlineText = deadlineParts.join(' ');

            const deadlineMatch = deadlineText.match(/(\d+)\s*дн\./);
            if (deadlineMatch) {
              const days = parseInt(deadlineMatch[1], 10);
              deadline = days;
            }

            const timeMatch = deadlineText.match(/до\s*(\d{1,2}:\d{2})/);
            if (timeMatch) {
              deadLineTimeToOrder = timeMatch[1];
            }

            const deadLineMax = deadline + 1;

            const secondTdHtml = tds[1].innerHTML;
            const availabilityMatch = secondTdHtml.match(/<b>(.*?)<\/b>/);
            let availability = '';
            if (availabilityMatch && availabilityMatch[1]) {
              availability = availabilityMatch[1]
                .replace(/шт\./, '')
                .replace(/&gt;/g, '>')
                .replace(/&lt;/g, '<')
                .trim();
            }

            let price = 0;
            const priceSpan = document.querySelector('#mypricespan b');
            if (priceSpan && priceSpan.textContent) {
              const priceText = priceSpan.textContent.trim();
              price = parseFloat(
                priceText.replace(/[^\d.,]/g, '').replace(',', '.')
              );
            }

            const qtyZakazElement = document.getElementById(
              'QtyZakaz'
            ) as HTMLInputElement;
            const multi =
              (qtyZakazElement && parseInt(qtyZakazElement.min)) || 1;

            return {
              id: '',
              article: '',
              brand: brand || '',
              description: '',
              availability,
              price,
              warehouse,
              imageUrl: '',
              deadline,
              deadLineMax,
              deadLineTimeToOrder,
              supplier: '',
              probability: 99.9,
              needToCheckBrand: false,
              multi,
            };
          } catch (error) {
            console.warn(
              `${window.location.href} Ошибка при обработке строки: ${error}`
            );
            return null;
          }
        })
        .filter((item) => item !== null);
    },
    brand
  );

  if (!results.length) {
    logger.warn(`Результаты не найдены для товара: ${item.article}`);
  }

  const allResults: SearchResultsParsed[] = results.map(
    (result: SearchResultsParsed) => {
      result.supplier = supplier;

      const needToCheckBrandResult = needToCheckBrand(item.brand, result.brand);

      const deliveryDate = calculateDeliveryDate(result);

      return {
        ...result,
        id: uuidv4(),
        article: item.article,
        description,
        needToCheckBrand: needToCheckBrandResult,
        deliveryDate,
      };
    }
  );

  logger.info(
    `Получено ${allResults.length} результатов для товара: ${item.article}`
  );

  return allResults;
};

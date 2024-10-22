import { logger } from 'config/logger';
import { Page } from 'puppeteer';
import { ItemToParallelSearch } from 'types';
import { waitForPageNavigation } from 'utils/pupHelpers/pageHelpers';
import { v4 as uuidv4 } from 'uuid';

export const clarifyBrandService = async (
  page: Page,
  query: string
): Promise<ItemToParallelSearch[]> => {
  const selector = `tr[data-url="/search?pcode=${query}"]`;

  // Ожидаем появления элемента на странице
  await page.waitForSelector(selector, { timeout: 15_000 });

  // Проверяем наличие элемента перед взаимодействием
  const elementHandle = await page.$(selector);
  if (!elementHandle) {
    logger.error(`Элемент с селектором ${selector} не найден`);
    return [];
  }

  try {
    // Кликаем по элементу и ожидаем навигации
    await Promise.all([
      waitForPageNavigation(page, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      }),
      elementHandle.click(),
    ]);
  } catch (error) {
    logger.error(`Ошибка при клике по элементу: ${error}`);
    throw error;
  }

  // Извлекаем данные с новой страницы
  const results = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.startSearching'));
    return items.map((item) => {
      const brand =
        (item.querySelector('.brandInfoLink') as HTMLElement)?.innerText || '';

      const article =
        (item.querySelector('.casePartCode') as HTMLElement)?.innerText || '';

      const description =
        (item.querySelector('.caseDescription') as HTMLElement)?.innerText ||
        '';

      const dataUrl = (item as HTMLElement).getAttribute('data-link') || '';

      return {
        brand,
        article,
        description,
        dataUrl,
      };
    });
  });

  // Фильтруем результаты и добавляем уникальный идентификатор
  const filteredResults = results.filter((result) => result.brand !== '');

  if (filteredResults.length === 0) {
    logger.info(
      `[clarifyBrandService]  По заданному запросу - ${query} не найдено результатов.`
    );
  }

  return filteredResults.map((result) => ({
    id: uuidv4(),
    ...result,
  }));
};

import chalk from 'chalk';
import { Page } from 'puppeteer';
import { SearchResult, SearchResultsWithRestUg, SupplierName } from 'types';
import { log } from 'utils/log';
import { clickItem, waitForPageNavigation } from 'utils/pupHelpers/pageHelpers';
import { parsePickedUgResults } from 'utils/pupHelpers/parsePickedUgResults';

export const itemDataUgService = async (
  page: Page,
  item: SearchResult,
  supplier: SupplierName
): Promise<SearchResultsWithRestUg[]> => {
  await clickItem(page, `tr[data-url="${item.dataUrl}"]`);

  await waitForPageNavigation(page, { waitUntil: 'domcontentloaded' });

  await page.click(
    `tr.resultTr2[data-current-brand-number^="${item.article.toUpperCase()}"] td.resultDescription a`
  );

  // Собираем все результаты сразу
  const allResults = await parsePickedUgResults(page, item, supplier);

  // Логируем количество найденных результатов
  log(`Найдено результатов перед возвратом: ${allResults.length}`, {
    color: chalk.bgMagenta,
  });

  // Возвращаем все результаты
  return allResults;
};

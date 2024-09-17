import { Page } from 'puppeteer';
import { SearchResult, SearchResultsWithRestUg, SupplierName } from 'types';
import { inspect } from 'util';

export const itemDataUgService = async (
  page: Page,
  item: SearchResult,
  supplier: SupplierName
): Promise<SearchResultsWithRestUg[]> => {
  console.log(inspect({ page, item, supplier }, { colors: true, depth: 4 }));
  console.log(`itemDataUgService ${item.dataUrl}`);
  console.log(
    inspect(page.url(), { colors: true, showHidden: true, depth: 5 })
  );

  const element = page.locator(`tr[data-url="${item.dataUrl}"]`);
  await element.hover();
  await element.click();

  // await clickItem(page, `tr[data-url="${item.dataUrl}"]`);

  // await waitForPageNavigation(page, { waitUntil: 'networkidle2' });

  // await page.click(
  //   `tr.resultTr2[data-current-brand-number^="${item.article.toUpperCase()}"] td.resultDescription a`
  // );

  // const allResults = await parsePickedUgResults(page, item, supplier);

  // log(`Найдено результатов перед возвратом: ${allResults.length}`, {
  //   color: chalk.bgMagenta,
  // });

  // return allResults;
  return [];
};

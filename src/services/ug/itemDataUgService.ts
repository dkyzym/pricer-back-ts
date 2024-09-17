import chalk from 'chalk';
import { Page } from 'puppeteer';
import { SearchResult, SearchResultsWithRestUg, SupplierName } from 'types';
import { inspect } from 'util';
import { waitForPageNavigation } from '../../utils/pupHelpers/pageHelpers';
import { parsePickedUgResults } from '../../utils/pupHelpers/parsePickedUgResults';

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

  await waitForPageNavigation(page, { waitUntil: 'networkidle2' });

  const allResults = await parsePickedUgResults(page, item, supplier);

  console.log(
    chalk.bgYellowBright(
      `Найдено результатов перед возвратом: ${allResults.length}`
    )
  );

  return allResults;
};

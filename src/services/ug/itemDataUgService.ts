import chalk from 'chalk';
import { ParallelSearchParams, SearchResultsWithRestUg } from 'types';
import { inspect } from 'util';
import { waitForPageNavigation } from 'utils/pupHelpers/pageHelpers';
import { parsePickedUgResults } from 'utils/pupHelpers/parsePickedUgResults';

export const itemDataUgService = async ({
  page,
  item,
  supplier,
}: ParallelSearchParams): Promise<SearchResultsWithRestUg[]> => {
  console.log(inspect({ page, item, supplier }, { colors: true, depth: 2 }));
  console.log(`itemDataUgService ${item.dataUrl}`);
  console.log(
    inspect(page.url(), { colors: true, showHidden: true, depth: 2 })
  );

  const element = page.locator(`tr[data-url="${item.dataUrl}"]`);
  await element.hover();
  await element.click();

  await waitForPageNavigation(page, { waitUntil: 'networkidle2' });

  const allResults = await parsePickedUgResults({ page, item, supplier });

  console.log(
    chalk.bgYellowBright(
      `Найдено результатов перед возвратом ${supplier} :  ${allResults.length}`
    )
  );

  return allResults;
};

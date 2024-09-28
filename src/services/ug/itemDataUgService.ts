import chalk from 'chalk';
import { ParallelSearchParams, SearchResultsParsed } from 'types';
import { waitForPageNavigation } from 'utils/pupHelpers/pageHelpers';
import { parsePickedUgResults } from 'utils/pupHelpers/parsePickedUgResults';

export const itemDataUgService = async ({
  page,
  item,
  supplier,
}: ParallelSearchParams): Promise<SearchResultsParsed[]> => {
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

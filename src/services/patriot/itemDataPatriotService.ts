import { parsePickedPatriotResults } from '@utils/pupHelpers/parsePickerPatriotResults';
import chalk from 'chalk';
import { SUPPLIERS_DATA } from 'constants/constants';
import { ParallelSearchParams, SearchResultsParsed } from 'types';
import { logWithRandomBackground } from 'utils/log';
import {
  clickItem,
  fillField,
  pressEnter,
  waitForPageNavigation,
} from 'utils/pupHelpers/pageHelpers';

export const itemDataPatriotService = async ({
  page,
  item,
  supplier,
}: ParallelSearchParams): Promise<SearchResultsParsed[]> => {
  const { selectors } = SUPPLIERS_DATA['patriot'];

  await fillField(page, selectors.input, item.article);

  await pressEnter(page);

  await waitForPageNavigation(page, { waitUntil: 'networkidle2' });

  const itemRowSelector = `.startSearching[data-link="/search/${item.brand}/${item.article}" i]`;

  const isInStock = !!(await page.$(itemRowSelector));

  console.log(chalk.bgWhiteBright(`inStock ${supplier}: ${isInStock} `));
  if (!isInStock) {
    return [];
  }

  await clickItem(page, itemRowSelector as string);

  const allResults = await parsePickedPatriotResults({
    page,
    item,
    supplier,
  });

  logWithRandomBackground(
    `Найдено результатов перед возвратом ${supplier}:  ${allResults?.length}`
  );

  return allResults;
};

import chalk from 'chalk';
import { ParallelSearchParams, SearchResultsParsed } from 'types';
import { SUPPLIERS_DATA } from 'utils/data/constants';
import {
  clickItem,
  fillField,
  pressEnter,
  waitForPageNavigation,
} from 'utils/pupHelpers/pageHelpers';
import { isInStockPatriot } from 'utils/pupHelpers/parsePickerPatriotResults';

export const itemDataPatriotService = async ({
  page,
  item,
  supplier,
}: ParallelSearchParams): Promise<SearchResultsParsed[]> => {
  const { selectors } = SUPPLIERS_DATA['patriot'];

  await fillField(page, selectors.input, item.article);

  await pressEnter(page);

  await waitForPageNavigation(page, { waitUntil: 'networkidle2' });

  const hasResults = await isInStockPatriot(page, item);
  console.log(chalk.bgWhiteBright(`hasResults ${supplier}: ${hasResults} `));
  if (!hasResults) {
    return [];
  }

  await clickItem(page, selectors.firstRowWrapper as string);

  return [];
};

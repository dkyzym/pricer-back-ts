import chalk from 'chalk';
import { SUPPLIERS_DATA } from 'constants/constants';
import { ParallelSearchParams } from 'types';
import {
  fillField,
  pressEnter,
  waitForPageNavigation,
} from 'utils/pupHelpers/pageHelpers';
import {
  isInStock,
  parsePickedTurboCarsResults,
} from 'utils/pupHelpers/parsePickerTurboCarsResults';

export const itemDataTurboCarsService = async ({
  page,
  item,
  supplier,
}: ParallelSearchParams): Promise<any> => {
  const { selectors } = SUPPLIERS_DATA[supplier];

  // console.log(
  //   inspect(page.url(), { colors: true, showHidden: true, depth: 5 })
  // );

  await fillField(page, selectors.input, item.article);

  await pressEnter(page);

  await waitForPageNavigation(page, { waitUntil: 'networkidle2' });

  const hasResults = await isInStock(page, item);

  if (!hasResults) {
    return [];
  }

  await page.click(selectors.firstRowWrapper as string);

  const allResults = await parsePickedTurboCarsResults({
    page,
    item,
    supplier,
  });

  console.log(
    chalk.bgYellowBright(
      `Найдено результатов перед возвратом ${supplier}:  ${allResults?.length}`
    )
  );

  return allResults;
};

import chalk from 'chalk';
import { ParallelSearchParams } from 'types';
import { SUPPLIERS_DATA } from 'utils/data/constants';
import { fillField, waitForPageNavigation } from 'utils/pupHelpers/pageHelpers';
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

  await page.keyboard.press('Enter');

  await waitForPageNavigation(page, { waitUntil: 'networkidle2' });

  const hasResults = await isInStock(page, item);

  if (!hasResults) {
    return [];
  }

  await page.click(selectors.firstRowWrapper as string);

  console.log('before parsing' + item.article + item.brand);
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

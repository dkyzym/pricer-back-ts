import { SUPPLIERS_DATA } from 'constants/constants';
import { ParallelSearchParams } from 'types';
import { logWithRandomBackground } from 'utils/log';
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

  await fillField(page, selectors.input, item.article);

  await pressEnter(page);

  await waitForPageNavigation(page, {
    waitUntil: 'networkidle2',
    timeout: 60_000,
  });

  const hasResults = await isInStock(page, item);

  if (!hasResults) {
    logWithRandomBackground(`Нет результатов от ${supplier}`);
    return null;
  }

  await page.click(selectors.firstRowWrapper as string);

  const allResults = await parsePickedTurboCarsResults({
    page,
    item,
    supplier,
  });

  logWithRandomBackground(
    `Найдено результатов перед возвратом ${supplier}:  ${allResults?.length}`
  );

  return allResults;
};

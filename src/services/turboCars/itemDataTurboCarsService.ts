import { SUPPLIERS_DATA } from '@constants/index';
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
import { logger } from 'config/logger';

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
    logger.info(`[${supplier}]: не нашли`);
    return [];
  }

  await page.click(selectors.firstRowWrapper as string);

  const allResults = await parsePickedTurboCarsResults({
    page,
    item,
    supplier,
  });

  return allResults;
};

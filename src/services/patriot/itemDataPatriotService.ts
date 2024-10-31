import { SUPPLIERS_DATA } from '@constants/index';
import { logger } from 'config/logger';
import { ParallelSearchParams, SearchResultsParsed } from 'types';
import {
  clickItem,
  fillField,
  pressEnter,
  waitForPageNavigation,
} from 'utils/pupHelpers/pageHelpers';
import { parsePickedUgResults } from 'utils/pupHelpers/parsePickedUgResults';
import { logResultCount } from 'utils/stdLogs';

export const itemDataPatriotService = async ({
  page,
  item,
  supplier,
}: ParallelSearchParams): Promise<SearchResultsParsed[]> => {
  const { selectors } = SUPPLIERS_DATA['patriot'];

  await fillField(page, selectors.input, item.article);
  await pressEnter(page);
  await waitForPageNavigation(page, {
    waitUntil: 'networkidle2',
    timeout: 60_000,
  });

  const dataLingContent = `${encodeURIComponent(item.brand)}/${encodeURIComponent(item.article)}`;
  const itemRowSelector = `.startSearching[data-link="/search/${dataLingContent}" i]`;

  const elementExists = await page.$(itemRowSelector);

  if (elementExists) {
    logger.info(`[${supplier}] Элемент существует, выполняем клик.`);
    await clickItem(page, itemRowSelector);
  } else {
    logger.info(
      `${supplier} Элемент ${itemRowSelector} не найден. Продолжаем без клика.`
    );
  }
  // используем сервис парсинга ЮГ, так как они идентичны
  // а переименовывать не охота
  const allResults = await parsePickedUgResults({
    page,
    item,
    supplier,
  });

  logResultCount(item, supplier, allResults);

  return allResults;
};

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
  await waitForPageNavigation(page, {
    waitUntil: 'networkidle2',
    timeout: 60_000,
  });

  const dataLingContent = `${encodeURIComponent(item.brand)}/${encodeURIComponent(item.article)}`;
  const itemRowSelector = `.startSearching[data-link="/search/${dataLingContent}" i]`;

  // console.log(chalk.underline('Проверка необходимости клика'));

  const elementExists = await page.$(itemRowSelector);

  if (elementExists) {
    console.log('Элемент существует, выполняем клик.');
    await clickItem(page, itemRowSelector);
  } else {
    return [];
    console.log(`Элемент ${itemRowSelector} не найден. Продолжаем без клика.`);
  }

  console.log(chalk.underline('После условного клика или пропуска'));

  const allResults = await parsePickedPatriotResults({
    page,
    item,
    supplier,
  });

  logWithRandomBackground(
    `Найдено результатов перед возвратом ${supplier}: ${allResults ? allResults.length : 0}`
  );

  return allResults;
};

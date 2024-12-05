import { ParallelSearchParams, SearchResultsParsed } from 'types';
import { waitForPageNavigation } from 'utils/pupHelpers/pageHelpers';

export const itemDataUgService = async ({
  page,
  item,
  supplier,
}: ParallelSearchParams): Promise<SearchResultsParsed[]> => {
  let element = null;
  const pageUrl = page.url().toLowerCase();

  const searchPcodeUrl =
    `https://ugautopart.ru/search?pcode=${item.article}`.toLowerCase();

  if (pageUrl === searchPcodeUrl) {
    element = page.locator(`a[href="${item.dataUrl}" i]`);
  } else {
    element = page.locator(`tr[data-url="${item.dataUrl}" i]`);
  }

  await element.click();

  await waitForPageNavigation(page, {
    waitUntil: 'networkidle2',
    timeout: 60_000,
  });

  // const allResults = await parsePickedUgResults({ page, item, supplier });

  return [];
};

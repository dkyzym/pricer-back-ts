import { Page } from 'puppeteer';
import { ItemToParallelSearch } from 'types';
import { waitForPageNavigation } from 'utils/pupHelpers/pageHelpers';
import { v4 as uuidv4 } from 'uuid';

export const clarifyBrandService = async (
  page: Page,
  query: string
): Promise<ItemToParallelSearch[]> => {
  const selector = `tr[data-url="/search?pcode=${query}"]`;

  const element = page.locator(selector);
  await element.click();

  await waitForPageNavigation(page, {
    waitUntil: 'networkidle2',
    timeout: 60_000,
  });

  const results = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.startSearching'));
    return items.map((item) => {
      const brand =
        (item.querySelector('.brandInfoLink') as HTMLElement)?.innerText || '';

      const article =
        (item.querySelector('.casePartCode') as HTMLElement)?.innerText || '';

      const description =
        (item.querySelector('.caseDescription') as HTMLAreaElement)
          ?.innerText || '';

      const dataUrl = (item as HTMLElement).getAttribute('data-link') || '';

      return {
        brand,
        article,
        description,
        dataUrl,
      };
    });
  });

  const filteredResults = results.filter((result) => result.brand !== '');

  return filteredResults.map((result) => ({
    id: uuidv4(),
    ...result,
  }));
};

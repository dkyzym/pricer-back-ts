import { Page } from 'puppeteer';
import { v4 as uuidv4 } from 'uuid';

interface SearchResult {
  id: string;
  brand: string;
  article: string;
  dataUrl: string;
}

export const parseAutocompleteResults = async (
  page: Page
): Promise<SearchResult[]> => {
  await page.waitForSelector('tbody.ui-menu tr.ui-menu-item');

  const results = await page.evaluate(() => {
    const items = Array.from(
      document.querySelectorAll('tbody.ui-menu tr.ui-menu-item')
    );
    return items.map((item) => {
      const brand =
        (item.querySelector('td.searchFormAutocompleteBrand') as HTMLElement)
          ?.innerText || '';
      const article =
        (
          item.querySelector(
            'td.searchFormAutocompleteNumber strong'
          ) as HTMLElement
        )?.innerText || '';
      const dataUrl = (item as HTMLElement).getAttribute('data-url') || '';

      return {
        brand,
        article,
        dataUrl,
      };
    });
  });

  return results.map((result) => ({
    id: uuidv4(),
    ...result,
  }));
};

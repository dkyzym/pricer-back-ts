import chalk from 'chalk';
import { Page } from 'puppeteer';
import { v4 as uuidv4 } from 'uuid';
import { SearchResult } from '../../types';
import { log } from '../log';

export const parseAutocompleteResults = async (
  page: Page,
  query: string
): Promise<SearchResult[]> => {
  log(query + ' ' + query.length, { color: chalk.bgCyan });

  if (query.length <= 3) {
    log('Query too short, clearing results.', { color: chalk.bgRed });
    return [];
  }

  await page.waitForSelector('tbody.ui-menu tr.ui-menu-item');
  await page.waitForNetworkIdle({ idleTime: 300 });

  const results = await page.evaluate(() => {
    const items = Array.from(
      document.querySelectorAll('tbody.ui-menu tr.ui-menu-item')
    );
    return items.map((item) => {
      const brand =
        (item.querySelector('td.searchFormAutocompleteBrand') as HTMLElement)
          ?.innerText || '';

      const articleElement = item.querySelector(
        'td.searchFormAutocompleteNumber'
      ) as HTMLElement;
      const article = articleElement
        ? Array.from(articleElement.childNodes)
            .map((node) => node.textContent)
            .join('')
        : '';

      const description =
        (
          item.querySelector(
            'td.searchFormAutocompleteDescription'
          ) as HTMLAreaElement
        )?.innerText || '';

      const dataUrl = (item as HTMLElement).getAttribute('data-url') || '';

      return {
        brand,
        article,
        description,
        dataUrl,
      };
    });
  });

  return results.map((result) => ({
    id: uuidv4(),
    ...result,
  }));
};

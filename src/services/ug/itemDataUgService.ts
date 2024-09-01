import { Page } from 'puppeteer';
import { SearchResult } from 'types';
import { clickItem } from '../../utils/pupHelpers/pageHelpers';

export const itemDataUgService = async (page: Page, item: SearchResult) => {
  // await page.locator();
  await clickItem(page, `tr[data-url="${item.dataUrl}"]`);
};

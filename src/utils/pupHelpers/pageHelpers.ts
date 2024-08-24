import { HTTPResponse, Page, WaitForOptions } from 'puppeteer';

export const clickButton = async (page: Page, selector: string) => {
  await page.locator(selector).click();
};

export const fillField = async (page: Page, selector: string, text: string) => {
  await page.locator(selector).fill(text);
};

export const waitForPageNavigation = async (
  page: Page,
  options?: WaitForOptions
): Promise<HTTPResponse | null> => {
  return await page.waitForNavigation(options);
};

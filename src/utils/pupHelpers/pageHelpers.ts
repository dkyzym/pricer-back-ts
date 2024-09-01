import { HTTPResponse, Page, WaitForOptions } from 'puppeteer';
import { Selectors } from 'types';

export const clickButton = async (page: Page, selector: keyof Selectors) => {
  await page.locator(selector as string).click();
};

export const clickItem = async (page: Page, selector: string) => {
  await page.locator(selector as string).click();
};

export const fillField = async (
  page: Page,
  selector: keyof Selectors,
  text: string
) => {
  await page.locator(selector as string).fill(text);
};

export const waitForPageNavigation = async (
  page: Page,
  options?: WaitForOptions
): Promise<HTTPResponse | null> => {
  return await page.waitForNavigation(options);
};

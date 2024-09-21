import { HTTPResponse, Page, WaitForOptions } from 'puppeteer';
import { Selectors } from 'types';

export const clickButton = async (page: Page, selector: keyof Selectors) => {
  await page.locator(selector as string).click();
};

export const clickItem = async (page: Page, selector: string) => {
  const element = await page.locator(selector as string);
  await element.click();
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

export const clickOutsideInput = async (query: string, page: Page) => {
  return query.length === 0 && (await clickItem(page, '.searchFormTitleBlock'));
};

export const pressEnter = async (page: Page) => {
  return await page.keyboard.press('Enter');
};

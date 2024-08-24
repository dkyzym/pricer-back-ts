import puppeteer, { Browser, Page } from 'puppeteer';

let browser: Browser | null = null;

export const initBrowser = async (): Promise<Browser> => {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: false,
      devtools: true,
    });
  }
  return browser;
};

export const createPage = async (): Promise<Page> => {
  const browser = await initBrowser();
  const page = await browser.newPage();

  await page.setViewport({ width: 540, height: 512 });

  return page;
};

export const closeBrowser = async (): Promise<void> => {
  if (browser) {
    await browser.close();
    browser = null;
  }
};

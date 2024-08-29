import puppeteer, { Browser, Page } from 'puppeteer';

let browser: Browser | null = null;
const pagesMap: Map<string, Page> = new Map();

export const initBrowser = async (): Promise<Browser> => {
  if (!browser || !browser.connected) {
    browser = await puppeteer.launch({
      headless: false,
      devtools: true,
    });
  }
  return browser;
};

export const getPage = async (url: string): Promise<Page> => {
  const browser = await initBrowser();
  const existingPage = pagesMap.get(url);

  if (existingPage && !existingPage.isClosed()) {
    await existingPage.bringToFront();
    return existingPage;
  }

  const newPage = await browser.newPage();

  await newPage.setViewport({ width: 1280, height: 1024 });
  await newPage.goto(url, { waitUntil: 'domcontentloaded' });
  pagesMap.set(url, newPage);

  return newPage;
};

export const closeBrowser = async (): Promise<void> => {
  if (browser) {
    await browser.close();
    browser = null;
  }
};

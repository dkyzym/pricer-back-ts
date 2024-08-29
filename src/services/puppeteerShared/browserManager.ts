import { Mutex } from 'async-mutex';
import puppeteer, { Browser, Page } from 'puppeteer';

let browser: Browser | null = null;
const pagesMap: Map<string, Page> = new Map();
const browserMutex = new Mutex();
const pageMutexMap: Map<string, Mutex> = new Map();

export const initBrowser = async (): Promise<Browser> => {
  return await browserMutex.runExclusive(async () => {
    if (!browser || !browser.isConnected()) {
      browser = await puppeteer.launch({
        headless: false,
        devtools: true,
      });
    }
    return browser;
  });
};

export const getPage = async (url: string): Promise<Page> => {
  const browser = await initBrowser();

  let pageMutex = pageMutexMap.get(url);
  if (!pageMutex) {
    pageMutex = new Mutex();
    pageMutexMap.set(url, pageMutex);
  }

  return await pageMutex.runExclusive(async () => {
    let page = pagesMap.get(url);

    if (page && !page.isClosed()) {
      await page.bringToFront();
    } else {
      page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 1024 });
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      pagesMap.set(url, page);
    }

    return page;
  });
};

export const closeBrowser = async (): Promise<void> => {
  await browserMutex.runExclusive(async () => {
    if (browser) {
      await browser.close();
      browser = null;
    }
  });
};

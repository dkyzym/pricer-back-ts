import { Mutex } from 'async-mutex';
import puppeteer, { Browser, Page } from 'puppeteer';
import { HEADLESS_SETTINGS } from 'utils/data/constants';

let browser: Browser | null = null;
const pagesMap: Map<string, Page> = new Map();
const browserMutex = new Mutex();
const pageMutexMap: Map<string, Mutex> = new Map();

export const initBrowser = async (): Promise<Browser> => {
  return await browserMutex.runExclusive(async () => {
    if (!browser || !browser.connected) {
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

      await page.setUserAgent(HEADLESS_SETTINGS.userAgent);
      await page.setExtraHTTPHeaders(HEADLESS_SETTINGS.language);

      await page.setViewport({
        width: 1280,
        height: 1024,
        deviceScaleFactor: 1,
      });

      await page.goto(url, { waitUntil: 'networkidle2' });

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

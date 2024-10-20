import { logger } from 'config/logger';
import { Browser, Page } from 'puppeteer';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { SupplierName } from 'types';

puppeteer.use(StealthPlugin());

const browsers: Map<SupplierName, Browser> = new Map();
const pages: Map<SupplierName, Page> = new Map();

export const initBrowser = async (supplier: SupplierName): Promise<Browser> => {
  let browser = browsers.get(supplier);
  if (!browser || !browser.connected) {
    logger.info(`Launching new browser for supplier: ${supplier}`);
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--window-size=1280,1024',
        '--disable-blink-features=AutomationControlled',
        '--lang=ru-RU,ru',
      ],
      defaultViewport: null,
    });
    browsers.set(supplier, browser);

    const pagesArray = await browser.pages();
    if (pagesArray.length > 0) {
      await pagesArray[0].close();
    }
  }
  return browser;
};

export const getPage = async (
  supplier: SupplierName,
  url: string
): Promise<Page> => {
  const browser = await initBrowser(supplier);
  const waitTimeOutPeriod = 60_000;

  let page = pages.get(supplier);
  if (page && !page.isClosed()) {
    logger.info(`Reusing existing page for supplier: ${supplier}`);

    await page.bringToFront();

    await page.waitForFunction(() => document.readyState === 'complete', {
      timeout: waitTimeOutPeriod,
    });
  } else {
    logger.info(`Opening page for supplier: ${supplier}, URL: ${url}`);

    const context = await browser.createBrowserContext();
    page = await context.newPage();

    await browser.userAgent();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36'
    );

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'ru-RU,ru;q=0.9',
    });

    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      (window as any).chrome = {
        runtime: {},
      };

      Object.defineProperty(navigator, 'languages', {
        get: () => ['ru-RU', 'ru'],
      });

      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });
    });

    await page.setViewport({
      width: 1280,
      height: 1024,
      deviceScaleFactor: 1,
    });

    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const headers = {
        ...request.headers(),
        'Accept-Language': 'ru-RU,ru;q=0.9',
      };
      request.continue({ headers });
    });

    page.on('pageerror', (err) => {
      logger.error(`${[page?.url()]}, ${err}`);
    });

    page.on('error', (err) => {
      logger.error(`Page crashed ${[page?.url()]}: ${err}`);
    });

    page.on('requestfailed', (request) => {
      logger.warn(
        `Request failed: ${request.url()} ${request.failure()?.errorText}`
      );
    });

    page.on('response', (response) => {
      if (!response.ok()) {
        logger.warn(
          `Response error: ${response.url()} Status: ${response.status()}`
        );
      }
    });

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: waitTimeOutPeriod,
    });

    await page.waitForFunction(() => document.readyState === 'complete', {
      timeout: waitTimeOutPeriod,
    });

    pages.set(supplier, page);
  }

  return page;
};

declare global {
  interface Window {
    chrome: any;
  }
}

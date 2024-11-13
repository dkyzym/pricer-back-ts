import { logger } from 'config/logger';
import { Browser, BrowserContext, HTTPRequest, Page } from 'puppeteer';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { SupplierName } from 'types';

puppeteer.use(StealthPlugin());

let browser: Browser | null = null;
const contexts: Map<string, BrowserContext> = new Map();
const pages: Map<string, Page> = new Map();

export const initBrowser = async (): Promise<Browser> => {
  if (!browser || !browser.connected) {
    logger.info(`Launching new browser`);
    browser = await puppeteer.launch({
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--window-size=1440,576',
        '--disable-blink-features=AutomationControlled',
        '--lang=ru-RU,ru',
      ],
      defaultViewport: null,
    });

    // Добавляем обработчик на случай отключения браузера
    browser.on('disconnected', () => {
      browser = null;
      contexts.clear();
      pages.clear();
      logger.info(`Browser disconnected`);
    });
  }
  return browser;
};

export const getPage = async (
  supplier: SupplierName,
  url: string,
  sessionID: string
): Promise<Page> => {
  const browser = await initBrowser();
  const waitTimeOutPeriod = 60_000;
  const key = `${supplier}-${sessionID}`;

  let page = pages.get(key);
  if (page && !page.isClosed()) {
    logger.info(`Reusing existing page for supplier: ${supplier}`);
    await page.bringToFront();
  } else {
    logger.info(`Opening page for supplier: ${supplier}, URL: ${url}`);

    // Создаём или получаем существующий контекст
    let context = contexts.get(key);
    if (!context) {
      context = await browser.createBrowserContext();
      contexts.set(key, context);
    }

    page = await context.newPage();

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
      width: 1440,
      height: 576,
      deviceScaleFactor: 1,
    });

    // Включаем перехват запросов
    await page.setRequestInterception(true);

    page.on('request', (request: HTTPRequest) => {
      const resourceType = request.resourceType();
      const headers = {
        ...request.headers(),
        'Accept-Language': 'ru-RU,ru;q=0.9',
      };

      // Блокируем ненужные ресурсы
      if (['image', 'font'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue({ headers });
      }
    });

    page.on('pageerror', (err: Error) => {
      logger.error(`${page?.url()}, ${err}`);
    });

    page.on('error', (err: Error) => {
      logger.error(`Page crashed ${page?.url()}: ${err}`);
    });

    page.on('requestfailed', (request) => {
      logger.warn(
        `Request failed: ${request.url()} ${request.failure()?.errorText}`
      );
    });

    page.on('response', (response) => {
      if (!response.ok()) {
        logger.warn(
          `Response warn: ${response.url()} Status: ${response.status()}`
        );
      }
    });

    try {
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: waitTimeOutPeriod,
      });
    } catch (error) {
      logger.error(`Error during page.goto for supplier ${supplier}: ${error}`);
    }

    try {
      await page.waitForFunction(() => document.readyState === 'complete', {
        timeout: waitTimeOutPeriod,
      });
    } catch (error) {
      logger.error(`Error during waitForFunction: ${error}`);
    }

    pages.set(key, page);

    // Добавляем обработчик закрытия страницы
    page.on('close', () => {
      pages.delete(key);
      logger.info(`Page closed for supplier: ${supplier}`);
    });
  }

  return page;
};

export const closePage = async (supplier: SupplierName): Promise<void> => {
  const page = pages.get(supplier);
  if (page && !page.isClosed()) {
    await page.close();
    pages.delete(supplier);
    logger.info(`Closed page for supplier: ${supplier}`);
  }
};

export const closeContext = async (supplier: SupplierName): Promise<void> => {
  const context = contexts.get(supplier);
  if (context) {
    await context.close();
    contexts.delete(supplier);
    logger.info(`Closed context for supplier: ${supplier}`);
  }
};

export const closeBrowser = async (): Promise<void> => {
  if (browser && browser.connected) {
    await browser.close();
    browser = null;
    contexts.clear();
    pages.clear();
    logger.info(`Closed browser`);
  }
};

export const closeAllResources = async () => {
  const suppliers: SupplierName[] = ['ug', 'turboCars', 'patriot'];
  for (const supplier of suppliers) {
    await closePage(supplier);
    await closeContext(supplier);
  }
  await closeBrowser();
};

declare global {
  interface Window {
    chrome: any;
  }
}

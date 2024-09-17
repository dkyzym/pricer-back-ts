import puppeteer, { Browser, Page } from 'puppeteer';
import { SupplierName } from 'types';
import { inspect } from 'util';

const browsers: Map<SupplierName, Browser> = new Map();
const pages: Map<SupplierName, Page> = new Map();

export const initBrowser = async (supplier: SupplierName): Promise<Browser> => {
  let browser = browsers.get(supplier);
  if (!browser || !browser.connected) {
    console.log(`Launching new browser for supplier: ${supplier}`);
    browser = await puppeteer.launch({
      headless: false,
      devtools: true,
    });
    browsers.set(supplier, browser);
    console.log(inspect(browsers, { colors: true, depth: Infinity }));
  }
  return browser;
};

export const getPage = async (
  supplier: SupplierName,
  url: string
): Promise<Page> => {
  const browser = await initBrowser(supplier);

  let page = pages.get(supplier);
  if (page && !page.isClosed()) {
    console.log(`Reusing existing page for supplier: ${supplier}`);
    await page.bringToFront();
  } else {
    console.log(`Opening page for supplier: ${supplier}, URL: ${url}`);

    const pagesArray = await browser.pages();

    if (pagesArray.length > 0) {
      page = pagesArray[0];
    } else {
      page = await browser.newPage();
    }

    // await page.setUserAgent('your-user-agent');
    // await page.setExtraHTTPHeaders({ 'Accept-Language': 'ru' });
    await page.setViewport({
      width: 1280,
      height: 1024,
      deviceScaleFactor: 1,
    });
    await page.goto(url, { waitUntil: 'networkidle2' });
    pages.set(supplier, page);
    console.log(inspect(pages, { showHidden: true, depth: 2, colors: true }));
  }
  2;

  return page;
};

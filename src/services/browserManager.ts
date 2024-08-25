import puppeteer, { Browser, Page } from 'puppeteer';

let browser: Browser | null = null;
const pagesMap: Map<string, Page> = new Map();

export const initBrowser = async (): Promise<Browser> => {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: false,
      devtools: true,
    });
  }
  return browser;
};

// export const createPage = async (): Promise<Page> => {
//   const browser = await initBrowser();
//   const page = await browser.newPage();

//   await page.setViewport({ width: 540, height: 512 });

//   return page;
// };

export const getPage = async (url: string): Promise<Page> => {
  const existingPage = pagesMap.get(url);

  if (existingPage && !existingPage.isClosed()) {
    // Если страница уже открыта и не закрыта, возвращаем её
    await existingPage.bringToFront();
    return existingPage;
  }

  // Если страницы нет, создаем новую
  const browser = await initBrowser();
  const newPage = await browser.newPage();
  await newPage.goto(url, { waitUntil: 'domcontentloaded' });
  pagesMap.set(url, newPage); // Сохраняем страницу в Map

  return newPage;
};

export const closeBrowser = async (): Promise<void> => {
  if (browser) {
    await browser.close();
    browser = null;
  }
};

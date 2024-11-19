import { logger } from 'config/logger';
import { Browser, BrowserContext, Page } from 'puppeteer';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

let browser: Browser | null = null;
const contexts: Map<string, BrowserContext> = new Map();
const pages: Map<string, Page> = new Map();

export const initBrowser = async (): Promise<Browser> => {
  if (!browser || !browser.connected) {
    logger.info(`Launching new browser`);
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--window-size=1440,900',
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

declare global {
  interface Window {
    chrome: any;
  }
}

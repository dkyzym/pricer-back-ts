import fs from 'fs/promises';
import path, { dirname } from 'path';
import { Page } from 'puppeteer';
import { SessionData, SupplierName } from 'types';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const saveSession = async (
  page: Page,
  supplier: SupplierName
): Promise<void> => {
  const cookies = await page.cookies();

  const localStorage = await page.evaluate(() => {
    let store: { [key: string]: string } = {};
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key) {
        store[key] = window.localStorage.getItem(key) as string;
      }
    }
    return store;
  });

  const sessionStorage = await page.evaluate(() => {
    let store: { [key: string]: string } = {};
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i);
      if (key) {
        store[key] = window.sessionStorage.getItem(key) as string;
      }
    }
    return store;
  });

  const sessionData: SessionData = { cookies, localStorage, sessionStorage };
  const sessionFilePath = path.resolve(
    __dirname,
    `../sessions/${supplier}/session.json`
  );
  await fs.mkdir(path.dirname(sessionFilePath), { recursive: true });
  await fs.writeFile(sessionFilePath, JSON.stringify(sessionData, null, 2));
};

export const loadSession = async (
  page: Page,
  supplier: SupplierName
): Promise<void> => {
  const sessionFilePath = path.resolve(
    __dirname,
    `../sessions/${supplier}/session.json`
  );

  try {
    const sessionData: SessionData = JSON.parse(
      await fs.readFile(sessionFilePath, 'utf-8')
    );

    await page.setCookie(...sessionData.cookies);

    await page.evaluateOnNewDocument((localStorageData) => {
      for (const key in localStorageData) {
        localStorage.setItem(key, localStorageData[key]);
      }
    }, sessionData.localStorage);

    await page.evaluateOnNewDocument((sessionStorageData) => {
      for (const key in sessionStorageData) {
        sessionStorage.setItem(key, sessionStorageData[key]);
      }
    }, sessionData.sessionStorage);
  } catch (error) {
    console.error('Failed to load session:', error);
  }
};

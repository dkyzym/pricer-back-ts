import fs from 'fs/promises';
import path from 'path';
import { Page } from 'puppeteer';

export const saveSession = async (
  page: Page,
  sessionName: string
): Promise<void> => {
  const cookies = await page.cookies();
  const sessionData = { cookies };
  const sessionPath = path.resolve(
    __dirname,
    '../sessions',
    `${sessionName}.json`
  );
  await fs.writeFile(sessionPath, JSON.stringify(sessionData, null, 2));
};

export const loadSession = async (
  page: Page,
  sessionName: string
): Promise<void> => {
  const sessionPath = path.resolve(
    __dirname,
    '../sessions',
    `${sessionName}.json`
  );
  const sessionData = JSON.parse(
    await fs.readFile(sessionPath, 'utf-8')
  );
  await page.setCookie(...sessionData.cookies);
};

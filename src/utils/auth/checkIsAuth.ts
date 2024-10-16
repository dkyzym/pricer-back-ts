import { logger } from 'config/logger/index.js';
import { SUPPLIERS_DATA } from 'constants/index.js';
import { Page } from 'puppeteer';
import { Selectors, SupplierData } from 'types';
import { UnAuthorizedError } from '../errors.js';

export const checkElementTextForAuthorization = async (
  page: Page,
  selector: Selectors['credentialsEl'],
  expectedText: SupplierData['credentials']
): Promise<boolean> => {
  try {
    const elementText = await page.$eval(
      selector,
      (element) => element.textContent?.trim().toLowerCase() || ''
    );

    const isLoggedIn = elementText.includes(expectedText.toLowerCase());

    return isLoggedIn;
  } catch (error) {
    logger.error(`${page.url()} Error during authorization check: ${error}`);
    throw new UnAuthorizedError('Authorization check failed');
  }
};

export const checkTcAuth = async (
  page: Page,
  selector: Selectors['credentialsEl'],
  expectedText: SupplierData['credentials']
): Promise<boolean> => {
  // Проверяем наличие формы логина
  const loginFormExists = (await page.$('#formLOGIN')) !== null;

  if (loginFormExists) {
    // Если форма логина присутствует, значит, пользователь не залогинен
    return false;
  }

  // Проверяем наличие элемента credentialsEl
  try {
    const elementText = await page.$eval(
      selector,
      (element) => element.textContent?.trim().toLowerCase() || ''
    );

    return elementText.includes(expectedText.toLowerCase());
  } catch (error) {
    // Элемент credentialsEl не найден, значит, пользователь не залогинен
    return false;
  }
};

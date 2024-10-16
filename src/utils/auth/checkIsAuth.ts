import { SUPPLIERS_DATA } from '@constants/index.js';
import { logger } from 'config/logger/index.js';
import { Page } from 'puppeteer';
import { Selectors, SupplierData } from 'types';
import { UnAuthorizedError } from '../errors.js';
import { waitForPageNavigation } from '../pupHelpers/pageHelpers';

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
) => {
  const { dashboardURL } = SUPPLIERS_DATA['turboCars'];
  let url = page.url();

  const element = await page.$('#formLOGIN');

  if (element) {
    return false;
  } else if (url === 'https://turbo-cars.net/office/login.asp?mode=new') {
    return true;
  } else {
    if (url !== dashboardURL) {
      await page.goto(dashboardURL as string, {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
      });

      await waitForPageNavigation(page, {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
      });
    }

    const result = await checkElementTextForAuthorization(
      page,
      selector,
      expectedText
    );

    return result;
  }
};

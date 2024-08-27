import chalk from 'chalk';
import { Page } from 'puppeteer';
import { Selectors, SupplierData } from 'types';
import { SUPPLIERS_DATA } from '../data/constants';
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

    if (!isLoggedIn) {
      // throw new UnAuthorizedError('Not logged in');
      console.error('Not logged in');
    }

    console.log(chalk.bgBlue('Has credentials:', isLoggedIn));
    return isLoggedIn;
  } catch (error) {
    console.error(chalk.bgRed('Error during authorization check:'), error);
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
    console.log('No form');
    return false;
  } else if (url === 'https://turbo-cars.net/office/login.asp?mode=new') {
    return true;
  } else {
    if (url !== dashboardURL) {
      await page.goto(dashboardURL as string);

      await waitForPageNavigation(page, { waitUntil: 'domcontentloaded' });
    }

    const result = await checkElementTextForAuthorization(
      page,
      selector,
      expectedText
    );

    return result;
  }
};

import { Page } from 'puppeteer';
import { checkIsLoggedIn } from '../../../utils/checkIsAuth';
import { SUPPLIERS_DATA } from '../../../utils/data/constants';
import {
  clickButton,
  fillField,
  waitForPageNavigation,
} from '../../../utils/pupHelpers/pageHelpers';

const { loginURL, credentials, dashboardURL } = SUPPLIERS_DATA['orion'];

export const loginToOrionService = async (
  page: Page,
  username: string,
  password: string
): Promise<boolean> => {
  await page.goto(loginURL, {
    waitUntil: 'domcontentloaded',
  });

  await clickButton(page, 'a[data-bs-toggle="modal"]');

  await fillField(page, '#email_auth', username); // email

  await fillField(page, '#password_auth', password); // password

  await clickButton(page, '.btn-login');

  await waitForPageNavigation(page, { waitUntil: 'domcontentloaded' });

  const pageContent = await page.content();

  const isLoggedIn = checkIsLoggedIn(pageContent, credentials);

  return isLoggedIn;
};

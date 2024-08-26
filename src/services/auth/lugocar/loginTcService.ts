import {
  checkElementTextForAuthorization,
  checkTcAuth,
} from '@utils/auth/checkIsAuth';
import { SUPPLIERS_DATA } from '@utils/data/constants';
import {
  clickButton,
  fillField,
  waitForPageNavigation,
} from '@utils/pupHelpers/pageHelpers';
import { Page } from 'puppeteer';
import { isLoggedInResult } from '../../../types';

export const loginTcService = async (
  page: Page,
  username: string,
  password: string
): Promise<isLoggedInResult> => {
  const { credentials, selectors, dashboardURL } = SUPPLIERS_DATA['turboCars'];

  const isLoggedIn = await checkTcAuth(
    page,
    selectors.credentialsEl,
    credentials
  );
  console.log('isLoggedIn before if', isLoggedIn);
  if (isLoggedIn) {
    console.log('inside isLoggedIn', isLoggedIn);
    return {
      success: true,
      message: 'Already logged in',
    };
  }

  await fillField(page, selectors.emailUsernameField, username);

  await fillField(page, selectors.passwordField, password);

  await clickButton(page, selectors.loginBtn);

  await waitForPageNavigation(page, { waitUntil: 'networkidle2' });

  await page.goto(dashboardURL as string, { waitUntil: 'networkidle2' });

  // await waitForPageNavigation(page, { waitUntil: 'networkidle2' });

  const loggedIn = await checkElementTextForAuthorization(
    page,
    selectors.credentialsEl,
    credentials
  );

  return {
    success: loggedIn,
    message: loggedIn ? 'Logged in successfully' : 'Login failed',
  };
};

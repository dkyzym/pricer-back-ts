import { checkTcAuth } from '@utils/auth/checkIsAuth';
import { SUPPLIERS_DATA } from '@utils/data/constants';
import {
  clickButton,
  waitForPageNavigation,
} from '@utils/pupHelpers/pageHelpers';
import { Page } from 'puppeteer';
import { isLoggedInResult } from '../../../types';

export const logoutTcService = async (
  page: Page
): Promise<isLoggedInResult> => {
  const { selectors, credentials } = SUPPLIERS_DATA['turboCars'];

  const isLoggedIn = await checkTcAuth(
    page,
    selectors.credentialsEl,
    credentials
  );

  if (!isLoggedIn) {
    return {
      success: false,
      message: 'Already logged out',
    };
  }

  await page.hover('#mnu4 > span');
  await clickButton(page, selectors.logoutBtn);
  await waitForPageNavigation(page, { waitUntil: 'domcontentloaded' });

  const loggedOut = !(await checkTcAuth(
    page,
    selectors.credentialsEl,
    credentials
  ));

  return {
    success: loggedOut,
    message: loggedOut ? 'Logged out successfully' : 'Logout failed',
  };
};

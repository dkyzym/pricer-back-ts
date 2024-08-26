import { checkElementTextForAuthorization } from '@utils/auth/checkIsAuth';
import { SUPPLIERS_DATA } from '@utils/data/constants';
import {
  clickButton,
  waitForPageNavigation,
} from '@utils/pupHelpers/pageHelpers';
import { Page } from 'puppeteer';
import { isLoggedInResult } from '../../../types';

export const logoutUgService = async (
  page: Page
): Promise<isLoggedInResult> => {
  const { selectors, credentials } = SUPPLIERS_DATA['ug'];

  const isLoggedIn = await checkElementTextForAuthorization(
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

  await clickButton(page, selectors.logoutBtn);
  await waitForPageNavigation(page, { waitUntil: 'domcontentloaded' });

  const loggedOut = !(await checkElementTextForAuthorization(
    page,
    selectors.credentialsEl,
    credentials
  ));

  return {
    success: loggedOut,
    message: loggedOut ? 'Logged out successfully' : 'Logout failed',
  };
};

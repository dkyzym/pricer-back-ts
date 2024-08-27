import { checkElementTextForAuthorization } from '@utils/auth/checkIsAuth';
import { SUPPLIERS_DATA } from '@utils/data/constants';
import {
  clickButton,
  waitForPageNavigation,
} from '@utils/pupHelpers/pageHelpers';
import { Page } from 'puppeteer';
import { isLoggedInResult, SupplierName } from '../../../types';

export const logoutPatriotService = async (
  page: Page
): Promise<isLoggedInResult> => {
  const supplier: SupplierName = 'patriot';
  const upperCaseSupplier = supplier.toUpperCase();

  const { selectors, credentials } = SUPPLIERS_DATA[supplier];

  const isLoggedIn = await checkElementTextForAuthorization(
    page,
    selectors.credentialsEl,
    credentials
  );

  if (!isLoggedIn) {
    return {
      success: false,
      message: `${upperCaseSupplier} Already logged out`,
    };
  }
  await clickButton(page, selectors.loginForm);

  await clickButton(page, selectors.logoutBtn);

  await waitForPageNavigation(page, { waitUntil: 'domcontentloaded' });

  const loggedOut = !(await checkElementTextForAuthorization(
    page,
    selectors.credentialsEl,
    credentials
  ));

  return {
    success: loggedOut,
    message: loggedOut
      ? ` ${upperCaseSupplier} Logged out successfully`
      : ` ${upperCaseSupplier} Logout failed`,
  };
};

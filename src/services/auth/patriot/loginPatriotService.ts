import { checkElementTextForAuthorization } from '@utils/auth/checkIsAuth';
import { SUPPLIERS_DATA } from '@utils/data/constants';
import {
  clickButton,
  fillField,
  waitForPageNavigation,
} from '@utils/pupHelpers/pageHelpers';
import { Page } from 'puppeteer';
import { isLoggedInResult, SupplierName } from '../../../types';

export const loginPatriotService = async (
  page: Page,
  username: string,
  password: string
): Promise<isLoggedInResult> => {
  const supplier: SupplierName = 'patriot';
  const upperCaseSupplier = supplier.toUpperCase();

  const { credentials, selectors } = SUPPLIERS_DATA[supplier];

  const isLoggedIn = await checkElementTextForAuthorization(
    page,
    selectors.credentialsEl,
    credentials
  );

  if (isLoggedIn) {
    return {
      success: true,
      message: `${upperCaseSupplier} Already logged in`,
    };
  }
  console.log('before click');
  await clickButton(page, selectors.loginForm);

  await fillField(page, selectors.emailUsernameField, username);

  await fillField(page, selectors.passwordField, password);

  await clickButton(page, selectors.loginBtn);

  await waitForPageNavigation(page, { waitUntil: 'domcontentloaded' });

  const loggedIn = await checkElementTextForAuthorization(
    page,
    selectors.credentialsEl,
    credentials
  );

  return {
    success: loggedIn,
    message: loggedIn
      ? `${upperCaseSupplier} Logged in successfully`
      : `${upperCaseSupplier} Login failed`,
  };
};

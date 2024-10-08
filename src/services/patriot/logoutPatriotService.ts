import { checkElementTextForAuthorization } from '@utils/auth/checkIsAuth';
import { getSupplierData } from '@utils/data/getSupplierData';
import {
  clickButton,
  waitForPageNavigation,
} from '@utils/pupHelpers/pageHelpers';
import { Page } from 'puppeteer';
import { pageActionsResult, SupplierName } from 'types';

export const logoutPatriotService = async (
  page: Page,
  supplier: SupplierName
): Promise<pageActionsResult> => {
  const { selectors, credentials } = getSupplierData(supplier);

  const isLoggedIn = await checkElementTextForAuthorization(
    page,
    selectors.credentialsEl,
    credentials
  );

  if (!isLoggedIn) {
    return {
      success: false,
      message: `${supplier}: Already logged out`,
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
      ? ` ${supplier}: Logged out successfully`
      : ` ${supplier}: Logout failed`,
  };
};

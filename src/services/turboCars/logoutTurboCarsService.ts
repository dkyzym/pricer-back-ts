import { checkTcAuth } from '@utils/auth/checkIsAuth';
import { getSupplierData } from '@utils/data/getSupplierData';
import {
  clickButton,
  waitForPageNavigation,
} from '@utils/pupHelpers/pageHelpers';
import { Page } from 'puppeteer';
import { pageActionsResult, SupplierName } from 'types';

export const logoutTurboCarsService = async (
  page: Page,
  supplier: SupplierName
): Promise<pageActionsResult> => {
  const { selectors, credentials } = getSupplierData(supplier);

  const isLoggedIn = await checkTcAuth(
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
    message: loggedOut
      ? `${supplier}: Logged out successfully`
      : `${supplier}: Logout failed`,
  };
};

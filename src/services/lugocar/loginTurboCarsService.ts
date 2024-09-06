import {
  checkElementTextForAuthorization,
  checkTcAuth,
} from '@utils/auth/checkIsAuth';
import { getSupplierData } from '@utils/data/getSupplierData';
import {
  clickButton,
  fillField,
  waitForPageNavigation,
} from '@utils/pupHelpers/pageHelpers';
import { LoginServiceParams, pageActionsResult } from 'types';

export const loginTurboCars = async ({
  page,
  username,
  password,
  supplier,
}: LoginServiceParams): Promise<pageActionsResult> => {
  const { credentials, selectors, dashboardURL } = getSupplierData(supplier);

  const isLoggedIn = await checkTcAuth(
    page,
    selectors.credentialsEl,
    credentials
  );

  if (isLoggedIn) {
    return {
      success: true,
      message: `${supplier}: Already logged in`,
    };
  }

  await fillField(page, selectors.emailUsernameField, username);

  await fillField(page, selectors.passwordField, password);

  await clickButton(page, selectors.loginBtn);

  await waitForPageNavigation(page, { waitUntil: 'networkidle2' });

  await page.goto(dashboardURL as string, { waitUntil: 'networkidle2' });

  const loggedIn = await checkElementTextForAuthorization(
    page,
    selectors.credentialsEl,
    credentials
  );

  return {
    success: loggedIn,
    message: loggedIn
      ? `${supplier}: Logged in successfully`
      : `${supplier}: Login failed`,
  };
};

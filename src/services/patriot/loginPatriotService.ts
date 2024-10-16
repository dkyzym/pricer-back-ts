import { checkElementTextForAuthorization } from '@utils/auth/checkIsAuth';
import { getSupplierData } from '@utils/data/getSupplierData';
import {
  clickButton,
  fillField,
  waitForPageNavigation,
} from '@utils/pupHelpers/pageHelpers';
import { LoginServiceParams, pageActionsResult } from 'types';
import { logger } from '../../config/logger';

export const loginPatriotService = async ({
  page,
  username,
  password,
  supplier,
}: LoginServiceParams): Promise<pageActionsResult> => {
  const { credentials, selectors } = getSupplierData(supplier);

  const isLoggedIn = await checkElementTextForAuthorization(
    page,
    selectors.credentialsEl,
    credentials
  );
  logger.info(`${supplier} isLoggedIn: ${isLoggedIn}`);

  if (isLoggedIn) {
    return {
      success: true,
      message: `${supplier}: Already logged in`,
    };
  }

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
      ? `${supplier}: Logged in successfully`
      : `${supplier}: Login failed`,
  };
};

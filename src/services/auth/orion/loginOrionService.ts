import { checkElementTextForAuthorization } from '@utils/checkIsAuth';
import { SUPPLIERS_DATA } from '@utils/data/constants';
import {
  clickButton,
  fillField,
  waitForPageNavigation,
} from '@utils/pupHelpers/pageHelpers';
import { Page } from 'puppeteer';

const { credentials, selectors } = SUPPLIERS_DATA['orion'];

export const loginOrionService = async (
  page: Page,
  username: string,
  password: string
): Promise<boolean> => {
  const isLoggedIn = checkElementTextForAuthorization(
    page,
    selectors.credentialsEl,
    credentials
  );

  if (await isLoggedIn) {
    return true;
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

  return loggedIn;
};

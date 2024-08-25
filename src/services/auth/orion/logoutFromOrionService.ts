import { SUPPLIERS_DATA } from '@utils/data/constants';
import {
  clickButton,
  waitForPageNavigation,
} from '@utils/pupHelpers/pageHelpers';
import { Page } from 'puppeteer';
import { checkElementTextForAuthorization } from '../../../utils/checkIsAuth';

export const logoutFromOrionService = async (page: Page) => {
  const { selectors, credentials } = SUPPLIERS_DATA['orion'];

  await clickButton(page, selectors.logoutBtn);
  await waitForPageNavigation(page, { waitUntil: 'domcontentloaded' });

  const loggedIn = await checkElementTextForAuthorization(
    page,
    selectors.credentialsEl,
    credentials
  );
  console.log('User has been logged out: ', !loggedIn);

  return !loggedIn;
};

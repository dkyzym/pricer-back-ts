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
import { Dialog } from 'puppeteer';
import { LoginServiceParams, pageActionsResult } from 'types';

export const loginTurboCars = async ({
  page,
  username,
  password,
  supplier,
}: LoginServiceParams): Promise<pageActionsResult> => {
  const { credentials, selectors, dashboardURL } = getSupplierData(supplier);

  page.on('dialog', async (dialog: Dialog) => {
    console.log('Dialog message:', dialog.message());
    await dialog.accept();
  });

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

  await waitForPageNavigation(page, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });

  const okButtonFound = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('*'));
    for (const element of elements) {
      if (element.textContent && element.textContent.trim() === 'OK') {
        (element as HTMLElement).click();
        return true;
      }
    }
    return false;
  });

  if (okButtonFound) {
    console.log('Found and clicked OK button');
    // await page.waitForTimeout(1000);
  } else {
    console.log('OK button not found');
  }

  // Переходим на страницу dashboard

  await page.goto(dashboardURL as string, {
    waitUntil: 'networkidle2',
    timeout: 60_000,
  });

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

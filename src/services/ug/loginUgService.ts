import { checkElementTextForAuthorization } from '@utils/auth/checkIsAuth';
import { getSupplierData } from '@utils/data/getSupplierData';
import {
  clickButton,
  fillField,
  waitForPageNavigation,
} from '@utils/pupHelpers/pageHelpers';
import chalk from 'chalk';
import { logger } from 'config/logger';
import { LoginServiceParams, pageActionsResult } from 'types';

export const loginUgService = async ({
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

  if (isLoggedIn) {
    return {
      success: true,
      message: `${supplier}: Already logged in`,
    };
  }
  const modalElement = await page.$('.wVisualFormLogin');

  if (modalElement) {
    await modalElement.evaluate((el: HTMLDivElement) => {
      (el as HTMLElement).style.display = 'block';
    });
  } else {
    logger.error(chalk.red(`${supplier}: Модальное окно не найдено`));
    return {
      success: false,
      message: `${supplier}: Modal window not found`,
    };
  }

  await fillField(page, selectors.emailUsernameField, username);

  await fillField(page, selectors.passwordField, password);

  await clickButton(page, selectors.loginBtn);

  await waitForPageNavigation(page, { waitUntil: 'domcontentloaded' });

  const loggedIn = await checkElementTextForAuthorization(
    page,
    selectors.credentialsEl,
    credentials
  );

  logger.info(chalk.blue(`${supplier} Залогинен?: ${loggedIn}`));

  return {
    success: loggedIn,
    message: loggedIn
      ? `${supplier}: Logged in successfully`
      : `${supplier}: Login failed`,
  };
};

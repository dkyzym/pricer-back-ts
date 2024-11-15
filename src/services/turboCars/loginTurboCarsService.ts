import { checkTcAuth } from '@utils/auth/checkIsAuth';
import { getSupplierData } from '@utils/data/getSupplierData';
import { clickButton, fillField } from '@utils/pupHelpers/pageHelpers';
import chalk from 'chalk';
import { logger } from 'config/logger';
import { Dialog } from 'puppeteer';
import { LoginServiceParams, pageActionsResult } from 'types';

export const loginTurboCarsService = async ({
  page,
  username,
  password,
  supplier,
}: LoginServiceParams): Promise<pageActionsResult> => {
  const { credentials, selectors, dashboardURL } = getSupplierData(supplier);

  page.on('dialog', async (dialog: Dialog) => {
    logger.warn(`${supplier} Dialog message:`, dialog.message());
    await dialog.accept();
  });

  const isLoggedIn = await checkTcAuth(page, selectors.credentialsEl, username);

  if (isLoggedIn) {
    return {
      success: true,
      message: `${supplier}: Already logged in`,
    };
  }

  await fillField(page, selectors.emailUsernameField, username);
  await fillField(page, selectors.passwordField, password);
  await clickButton(page, selectors.loginBtn);

  try {
    await Promise.race([
      page.waitForSelector(selectors.credentialsEl, { timeout: 10_000 }),
      page.waitForFunction(
        () => {
          const errorMessages = ['Внимание!'];
          return (
            document.body &&
            errorMessages.some((msg) => document.body.innerText.includes(msg))
          );
        },
        { timeout: 10_000 }
      ),
      new Promise((resolve) => setTimeout(resolve, 10_000)),
    ]);
  } catch (error) {
    logger.error(`${supplier}: Login failed or took too long.`);
    return {
      success: false,
      message: `${supplier}: Login failed or took too long`,
    };
  }

  if (page.url() !== dashboardURL) {
    await page.goto(dashboardURL as string, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    });
  }

  const loggedIn = await checkTcAuth(
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

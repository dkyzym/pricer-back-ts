import chalk from 'chalk';
import { Page } from 'puppeteer';
import { UnAuthorizedError } from './errors.js';

export const checkElementTextForAuthorization = async (
  page: Page,
  selector: string,
  expectedText: string
): Promise<boolean> => {
  try {
    // Извлекаем текст элемента по заданному селектору
    const elementText = await page.$eval(
      selector,
      (element) => element.textContent?.trim().toLowerCase() || ''
    );

    const isLoggedIn = elementText.includes(expectedText.toLowerCase());

    if (!isLoggedIn) {
      // throw new UnAuthorizedError('Not logged in');
      console.error('Not logged in');
    }

    console.log(chalk.bgBlue('Has credentials:', isLoggedIn));
    return isLoggedIn;
  } catch (error) {
    console.error(chalk.bgRed('Error during authorization check:'), error);
    throw new UnAuthorizedError('Authorization check failed');
  }
};

import chalk from 'chalk';
import { logger } from 'config/logger';
import path from 'path';
import { Page } from 'puppeteer';
import { pageActionsResult, SearchResultsParsed, SupplierName } from 'types';
import { fileURLToPath } from 'url';

export const addToCartUgService = async (
  page: Page,
  supplier: SupplierName,
  item: SearchResultsParsed,
  count: number
): Promise<pageActionsResult> => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const screenshotPath = path.join(
    __dirname,
    '..',
    '..',
    'screenshots',
    `error_screenshot_${Date.now()}.png`
  );

  try {
    const removeSymbols = (string: string) =>
      string.replace(/[^a-zA-Zа-яА-ЯёЁ0-9]/g, '');

    // Формируем селектор для строки товара
    const dataBrandNumberAttr = `${removeSymbols(item.article)}_${removeSymbols(item.brand)}`;
    const dataBrandAttr = `tr[data-current-brand-number="${dataBrandNumberAttr}" i]`;
    const dataAvailabilityAttr = `[data-availability="${item.availability}"]`;
    const dataOutputPriceAttr = `[data-output-price="${item.price}"]`;
    const dataDeadlineAttr = `[data-deadline="${item.deadline}"]`;
    const dataDeadlineMaxAttr = `[data-deadline-max="${item.deadLineMax}"]`;
    const targetRowSelector = `${dataBrandAttr}${dataAvailabilityAttr}${dataOutputPriceAttr}${dataDeadlineAttr}${dataDeadlineMaxAttr}`;
    const inputSelector = 'input.j-quantity-input.quantityInput';
    const addToCartButtonSelector = 'button.addToBasketLink';

    // Ждем появления строки товара
    await page.waitForSelector(targetRowSelector, { timeout: 5000 });

    // Селекторы для элементов внутри строки товара
    const inputElementSelector = `${targetRowSelector} ${inputSelector}`;
    const buyButtonSelector = `${targetRowSelector} ${addToCartButtonSelector}`;

    // Ждем появления и видимости поля ввода количества
    await page.waitForSelector(inputElementSelector, {
      visible: true,
      timeout: 5000,
    });

    // Очищаем поле и вводим количество
    await page.focus(inputElementSelector);
    await page.click(inputElementSelector, { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await page.type(inputElementSelector, count.toString(), { delay: 100 });

    // Ждем появления и видимости кнопки "Купить"
    await page.waitForSelector(buyButtonSelector, {
      visible: true,
      timeout: 5000,
    });

    // Выполняем клик по кнопке "Купить" через page.evaluate()
    await page.evaluate((selector) => {
      const button = document.querySelector(selector) as HTMLElement;
      if (button) {
        button.click();
      }
    }, buyButtonSelector);

    logger.info(`[${supplier}] ${item.article} Кнопка "Купить" нажата.`);

    // Ждем появления либо диалогового окна, либо тултипа
    await page.waitForFunction(
      () =>
        document.querySelector('div.ui-dialog') ||
        document.querySelector('div.ui-tooltip-content'),
      { timeout: 5000 }
    );

    // Обработка диалогового окна, если оно появилось
    const modalDialogSelector = 'div.ui-dialog';
    const modalDialog = await page.$(modalDialogSelector);

    if (modalDialog) {
      // Ждем, пока диалоговое окно станет видимым
      await page.waitForSelector(
        `${modalDialogSelector}[style*="display: block"]`,
        { timeout: 5000 }
      );

      // Селектор кнопок внутри диалогового окна
      const yesButtonSelector = `${modalDialogSelector} button`;

      // Находим все кнопки и кликаем по той, которая содержит текст "Да"
      const buttons = await page.$$(yesButtonSelector);
      let yesButtonFound = false;
      for (const button of buttons) {
        const buttonText = await page.evaluate(
          (el) => el.textContent?.trim(),
          button
        );
        if (buttonText === 'Да') {
          await page.evaluate((el) => (el as HTMLElement).click(), button);
          logger.info(`Подтвердили добавление еще ${item.article}`);
          yesButtonFound = true;
          break;
        }
      }

      if (!yesButtonFound) {
        throw new Error('Не найдена кнопка "Да" в диалоговом окне.');
      }
    }

    // Ждем появления тултипа
    const tooltipSelector = 'div.ui-tooltip-content';
    await page.waitForSelector(tooltipSelector, {
      visible: true,
      timeout: 5000,
    });
    const tooltipText = await page.$eval(tooltipSelector, (el) =>
      el.textContent?.trim()
    );

    if (tooltipText === 'Товар добавлен в корзину') {
      logger.info(`${item.brand} ${item.article} Добавлен в корзину`);
      return {
        message: `${item.brand} ${item.article} успешно добавлен`,
        success: true,
      };
    } else {
      logger.warn(
        'Тултип подтверждения добавления товара в корзину не соответствует ожиданиям.'
      );
      return {
        message: `Товар не добавлен в корзину`,
        success: false,
      };
    }
  } catch (error) {
    logger.error(`${supplier}: Error in addToCart:`, (error as Error).stack);
    console.log(chalk.yellow((error as Error).stack));
    console.log(chalk.yellow((error as Error).message));
    await page.screenshot({
      path: screenshotPath,
    });
    return {
      success: false,
      message: `Ошибка при добавлении в корзину: ${(error as Error).message}`,
    };
  }
};

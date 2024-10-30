import { Page } from 'puppeteer';
import { pageActionsResult, SearchResultsParsed, SupplierName } from 'types';
import { logger } from '../../config/logger';

export const addToCartUgService = async (
  page: Page,
  supplier: SupplierName,
  item: SearchResultsParsed,
  count: number
): Promise<pageActionsResult> => {
  try {
    // Формируем селектор для строки товара
    const dataBrandNumberAttr = `${item.article.replace(/\s/g, '')}_${item.brand.replace(/\s/g, '')}`;
    const dataBrandAttr = `tr[data-current-brand-number="${dataBrandNumberAttr}"]`;
    const dataAvailabilityAttr = `[data-availability="${item.availability}"]`;
    const dataOutputPriceAttr = `[data-output-price="${item.price}"]`;
    const dataDeadlineAttr = `[data-deadline="${item.deadline}"]`;
    const dataDeadlineMaxAttr = `[data-deadline-max="${item.deadLineMax}"]`;
    const targetRowSelector = `${dataBrandAttr}${dataAvailabilityAttr}${dataOutputPriceAttr}${dataDeadlineAttr}${dataDeadlineMaxAttr}`;
    const inputSelector = 'input.j-quantity-input.quantityInput';
    const addToCartButtonSelector = 'button.addToBasketLink';

    // Ждем появления строки товара
    await page.waitForSelector(targetRowSelector, { timeout: 5000 });
    const targetRow = await page.$(targetRowSelector);
    if (!targetRow) {
      throw new Error('Не найдена строка товара.');
    }

    const inputElement = await targetRow.$(inputSelector);
    if (!inputElement) {
      throw new Error('Не найдено поле ввода количества в строке товара.');
    }

    const buyButton = await targetRow.$(addToCartButtonSelector);
    if (!buyButton) {
      throw new Error('Не найдена кнопка "Купить" в строке товара.');
    }

    await inputElement.click();
    await inputElement.type(count.toString());
    await buyButton.click();
    console.log('Кнопка "Купить" нажата.');

    // Ждем появления либо диалогового окна, либо тултипа
    await page.waitForFunction(
      () => {
        return (
          document.querySelector('div.ui-dialog') ||
          document.querySelector('div.ui-tooltip-content')
        );
      },
      { timeout: 5000 }
    );

    const modalDialog = await page.$('div.ui-dialog');

    if (modalDialog) {
      // Если появилось диалоговое окно, находим кнопку "Да" и нажимаем
      const buttons = await modalDialog.$$('button');
      let yesButtonFound = false;
      for (const button of buttons) {
        const buttonText = await page.evaluate(
          (el) => el.textContent?.trim(),
          button
        );
        if (buttonText === 'Да') {
          await button.click();
          console.log('Нажата кнопка "Да" в диалоговом окне.');
          yesButtonFound = true;
          break;
        }
      }
      if (!yesButtonFound) {
        throw new Error('Не найдена кнопка "Да" в диалоговом окне.');
      }
      // Возвращаем успех без ожидания тултипа
      return {
        message: `${item.brand} ${item.article} успешно добавлен`,
        success: true,
      };
    } else {
      // Если диалогового окна нет, ждем появления тултипа
      await page.waitForSelector('div.ui-tooltip-content', { timeout: 5000 });

      const tooltipText = await page.$eval('div.ui-tooltip-content', (el) =>
        el.textContent?.trim()
      );

      if (tooltipText === 'Товар добавлен в корзину') {
        console.log(
          'Тултип подтверждения добавления товара в корзину обнаружен.'
        );
        return {
          message: `${item.brand} ${item.article} успешно добавлен`,
          success: true,
        };
      } else {
        console.log(
          'Тултип подтверждения добавления товара в корзину не соответствует ожиданиям.'
        );
      }

      return {
        message: `Товар не добавлен в корзину`,
        success: false,
      };
    }
  } catch (error) {
    logger.error(`${supplier}: Error in addToCart:`, (error as Error).stack);
    return {
      success: false,
      message: `Ошибка при добавлении в корзину: ${(error as Error).message}`,
    };
  }
};

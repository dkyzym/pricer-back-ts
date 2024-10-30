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

    return {
      message: `${item.brand} ${item.article} успешно добавлен`,
      success: true,
    };
  } catch (error) {
    logger.error(`${supplier}: Error in addToCart:`, (error as Error).stack);
    return {
      success: false,
      message: `Ошибка при добавлении в корзину: ${(error as Error).message}`,
    };
  }
};

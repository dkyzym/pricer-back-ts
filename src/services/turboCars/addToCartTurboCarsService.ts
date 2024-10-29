import chalk from 'chalk';
import { logger } from 'config/logger';
import { Page } from 'puppeteer';
import { pageActionsResult, SearchResultsParsed } from 'types';

// Quantity input
const quantityInputSelector = '#QtyZakaz';

// Delivery options container
const deliveryOptionsContainerSelector = '#ztab';

// Radio buttons for delivery options
const deliveryOptionRadioSelector = 'input[name="StSel"]';

// Submit order button
const submitOrderButtonSelector = '#INSERT';

const reserveCheckboxSelector = 'input[name="ReservCB"]';

export const addToCartTurboCarsService = async (
  page: Page,
  supplier: string,
  item: SearchResultsParsed,
  count: number
): Promise<pageActionsResult> => {
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('Failed to load resource: net::ERR_FAILED')) {
      // Ignore this error
      return;
    }
    console.log('PAGE LOG:', text);
  });

  // Suppress specific page errors
  page.on('pageerror', (err) => {
    const message = err.message || '';
    if (message.includes('__name is not defined')) {
      // Ignore this error
      return;
    }
    console.log('Page error:', err);
  });

  try {
    // Click on the quantity input
    const quantityInput = page.locator(quantityInputSelector);

    await quantityInput.click();

    // Wait for the delivery options container to become visible
    await page.waitForSelector(deliveryOptionsContainerSelector, {
      visible: true,
      timeout: 15000,
    });

    // Select the appropriate delivery option (radio button) based on warehouse name
    const warehouseName = item.warehouse; // Ensure this is available in `row`
    const deliveryOptions = await page.$$(deliveryOptionRadioSelector);

    let optionFound = false;

    for (const option of deliveryOptions) {
      const textContent = await page.evaluate((el) => {
        let text = '';
        let currentNode = el.nextSibling;
        while (currentNode) {
          if (currentNode.nodeType === Node.TEXT_NODE) {
            text += currentNode.textContent;
          } else if (currentNode.nodeType === Node.ELEMENT_NODE) {
            const element = currentNode as Element;
            if (element.tagName === 'BR') {
              // Пропускаем элементы <br>
            } else {
              break;
            }
          } else {
            break;
          }
          currentNode = currentNode.nextSibling;
        }
        return text.trim();
      }, option);

      if (textContent.includes(warehouseName)) {
        await option.click();
        optionFound = true;
        break;
      }
    }

    if (!optionFound) {
      throw new Error(`Не найден вариант склада: ${warehouseName}`);
    }

    await page.click(reserveCheckboxSelector);

    const isChecked = await page.$eval(
      reserveCheckboxSelector,
      (el) => (el as HTMLInputElement).checked
    );
    if (!isChecked)
      return {
        success: false,
        message: 'Чекбокс добавить в корзину не установлен',
      };

    // Enter the quantity
    await quantityInput.fill(count.toString());

    // Optionally, check the 'reserve' checkbox if needed

    // Click the submit order button
    await page.click(submitOrderButtonSelector);

    // Ожидание появления модального окна
    await page.waitForSelector('#msgbox', { visible: true, timeout: 15000 });

    // Ожидаем, пока в #msgpanel появится текст 'Результат:'
    await page.waitForFunction(
      () => {
        const msgPanel = document.querySelector('#msgpanel');
        return msgPanel && msgPanel.innerText.includes('Результат:');
      },
      { timeout: 15000 }
    );

    // Получение содержимого #msgpanel
    const msgPanelContent = await page.$eval('#msgpanel', (el) => el.innerText);

    // Выводим содержимое msgPanelContent
    console.log('msgPanelContent:', msgPanelContent);

    // Разбиваем содержимое на строки
    const lines = msgPanelContent.split('\n');

    // Ищем строку с 'Результат:'
    let confirmationResult = null;
    for (const line of lines) {
      if (line.trim().startsWith('Результат:')) {
        // Извлекаем результат
        confirmationResult = line.replace('Результат:', '').trim();
        break;
      }
    }

    // Выводим confirmationResult
    console.log('Confirmation Result:', confirmationResult);

    if (confirmationResult === 'OK') {
      // Закрываем модальное окно
      await page.keyboard.press('Escape');
      console.log(chalk.bgYellowBright('after escape'));

      await page.click('#Submit1');

      return {
        success: true,
        message: 'Товар успешно добавлен в корзину',
      };
    } else if (confirmationResult === null) {
      return {
        success: false,
        message: 'Не удалось получить результат подтверждения',
      };
    } else {
      return {
        success: false,
        message: `Не удалось добавить товар в корзину: ${confirmationResult}`,
      };
    }
  } catch (error) {
    logger.error(`${supplier}: Error in addToCart:`, (error as Error).stack);
    console.log(error);
    return {
      success: false,
      message: `Ошибка при добавлении в корзину: ${(error as Error).message}`,
    };
  }
};

import { logger } from 'config/logger';
import { Page } from 'puppeteer';
import { pageActionsResult, SearchResultsParsed, SupplierName } from 'types';
import { SUPPLIERS_DATA } from '../../constants';

export const addToCartTurboCarsService = async (
  page: Page,
  supplier: SupplierName,
  item: SearchResultsParsed,
  count: number
): Promise<pageActionsResult> => {
  const {
    quantityInputSelector,
    deliveryOptionsContainerSelector,
    deliveryOptionRadioSelector,
    submitOrderButtonSelector,
    reserveCheckboxSelector,
    messageBoxSelector,
    messagePanelSelector,
    searchButtonSelector,
  } = SUPPLIERS_DATA['turboCars'].selectors;

  //   page.on('console', (msg) => {
  //     const text = msg.text();
  //     if (text.includes('Failed to load resource: net::ERR_FAILED')) {
  //       // Ignore this error
  //       return;
  //     }
  //     logger.info('PAGE LOG:', text);
  //   });

  // Suppress specific page errors
  //   page.on('pageerror', (err) => {
  //     const message = err.message || '';
  //     if (message.includes('__name is not defined')) {
  //       // Ignore this error
  //       return;
  //     }
  //     logger.info('Page error:', err);
  //   });

  try {
    // Click on the quantity input
    const quantityInput = page.locator(quantityInputSelector!);

    await quantityInput.click();

    // Wait for the delivery options container to become visible
    await page.waitForSelector(deliveryOptionsContainerSelector!, {
      visible: true,
      timeout: 15000,
    });

    // Select the appropriate delivery option (radio button) based on warehouse name
    const warehouseName = item.warehouse; // Ensure this is available in `row`
    const deliveryOptions = await page.$$(deliveryOptionRadioSelector!);

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

    await page.click(reserveCheckboxSelector!);

    const isChecked = await page.$eval(
      reserveCheckboxSelector!,
      (el) => (el as HTMLInputElement).checked
    );
    if (!isChecked)
      return {
        success: false,
        message: 'Чекбокс добавить в корзину не установлен',
      };

    // Enter the quantity
    await quantityInput.fill(count.toString());

    // Click the submit order button
    await page.click(submitOrderButtonSelector!);

    // Ожидание появления модального окна
    await page.waitForSelector(messageBoxSelector!, {
      visible: true,
      timeout: 15000,
    });

    // Ожидаем, пока в #msgpanel появится текст 'Результат:'
    await page.waitForFunction(
      (selector) => {
        const msgPanel = document.querySelector(selector!);
        return (
          msgPanel &&
          (msgPanel as HTMLDivElement).innerText.includes('Результат:')
        );
      },
      { timeout: 15000 },
      messagePanelSelector!
    );

    // Получение содержимого #msgpanel
    const msgPanelContent = await page.$eval(
      messagePanelSelector!,
      (el) => (el as HTMLDivElement).innerText
    );

    // Выводим содержимое msgPanelContent
    // console.log('msgPanelContent:', msgPanelContent);

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

      await page.click(searchButtonSelector!);

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
    return {
      success: false,
      message: `Ошибка при добавлении в корзину: ${(error as Error).message}`,
    };
  }
};

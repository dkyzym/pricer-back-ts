import chalk from 'chalk';
import { Socket } from 'socket.io';
import { Logger } from 'winston';
import { SOCKET_EVENTS } from '../../constants/socketEvents.js';
import { getItemResultsParams, PageActionsResult } from '../../types/search.types.js';
import { AbcpError } from '../../utils/abcpErrorHandler.js';
import { filterAndSortAllResults } from '../../utils/filterAndSortResults/filterAndSortAllResults.js';
import { logResultCount } from '../../utils/stdLogs.js';
import { supplierHandlers } from './supplierHandlers.js';

// Фабричная функция, чтобы передать 'socket' и 'userLogger' в замыкание
export const createItemResultsHandler = (
  socket: Socket,
  userLogger: Logger
) => {
  return async (data: getItemResultsParams) => {
    const { item, supplier } = data;
    userLogger.info(`Received GET_ITEM_RESULTS for supplier: ${supplier}`);

    const handler = supplierHandlers[supplier];
    if (!handler) {
      const errorMsg = `Unknown supplier: ${supplier}`;
      userLogger.error(errorMsg);
      socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_ERROR, {
        supplier,
        error: errorMsg,
      });
      return;
    }

    try {
      socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_STARTED, {
        supplier,
        article: item.article,
      });

      const results = await handler(data, userLogger);

      logResultCount(item, userLogger, supplier, results);
      const filteredItems = filterAndSortAllResults(results);
      userLogger.info(
        chalk.bgYellow(
          `После фильтрации: ${supplier} - ${filteredItems?.length}`
        )
      );

      const response: PageActionsResult = {
        success: true,
        message: `Data fetched for ${supplier}`,
        data: filteredItems,
      };

      socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_SUCCESS, {
        supplier,
        result: response,
      });
    } catch (error) {
      // Централизованная обработка ошибок здесь
      if (error instanceof AbcpError && error.isSuccessWithNoData) {
        // Это не ошибка, а "ничего не найдено" от ABCP
        userLogger.warn(`${supplier} supplier: "no results" from provider.`);
        const result: PageActionsResult = {
          success: true,
          message: error.message,
          data: [],
        };
        socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_SUCCESS, {
          supplier,
          result,
        });
      } else {
        // Это настоящая ошибка
        userLogger.error(`Error processing supplier ${supplier}:`, error);
        socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_ERROR, {
          supplier,
          error: (error as Error).message,
        });
      }
    }
  };
};

import chalk from 'chalk';
import { Socket } from 'socket.io';
import { Logger } from 'winston';
import { SOCKET_EVENTS } from '../../constants/socketEvents.js';
import {
    getItemResultsParams,
    PageActionsResult,
    SearchResultsParsed,
} from '../../types/search.types.js';
import { AbcpError } from '../../utils/abcpErrorHandler.js';
import { filterAndSortAllResults } from '../../utils/filterAndSortResults/filterAndSortAllResults.js';
import { logResultCount } from '../../utils/stdLogs.js';
import { supplierHandlers } from './supplierHandlers.js';

/**
 * Единый обработчик для поиска товаров у любого поставщика.
 * Этот файл заменяет собой всю папку /suppliers с десятками хендлеров.
 * Он использует существующую карту `supplierHandlers` для вызова нужной логики.
 * @param socket - Экземпляр сокета клиента.
 * @param data - Данные от клиента, содержащие { item, supplier }.
 * @param userLogger - Экземпляр логгера.
 */
export const universalSupplierHandler = async (
    socket: Socket,
    data: getItemResultsParams,
    userLogger: Logger
) => {
    const { item, supplier } = data;

    // 1. Находим нужный обработчик в вашей карте
    const handler = supplierHandlers[supplier];

    if (!handler) {
        const errorMessage = `[${supplier}] Error: No handler found for this supplier.`;
        userLogger.error(errorMessage);
        socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_ERROR, {
            supplier,
            error: `Поставщик ${supplier} не поддерживается.`,
        });
        return;
    }

    try {
        // Сообщаем клиенту, что поиск начался
        socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_STARTED, {
            supplier,
            article: item.article,
        });
        userLogger.info(
            `[${supplier}] Searching for article: ${item.article}, brand: ${item.brand}`
        );

        // 2. Вызываем найденный обработчик
        const results = await handler(data, userLogger);
        logResultCount(item, userLogger, supplier, results);

        // 3. Фильтруем и сортируем результаты (как в старом хендлере)
        const filteredItems = filterAndSortAllResults(results);
        userLogger.info(
            chalk.bgYellow(`После фильтрации: ${supplier} - ${filteredItems?.length}`)
        );

        // 4. Формируем ответ в формате PageActionsResult
        const response: PageActionsResult<SearchResultsParsed[]> = {
            success: true,
            message: `Data fetched for ${supplier}`,
            data: filteredItems,
        };

        // 5. Отправляем успешный результат клиенту
        socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_SUCCESS, {
            supplier,
            result: response,
        });
    } catch (error: any) {
        // 6. Централизованно обрабатываем ошибки
        if (error instanceof AbcpError && error.isSuccessWithNoData) {
            // Это не ошибка, а "ничего не найдено" от ABCP
            userLogger.warn(`${supplier} supplier: "no results" from provider.`);
            const result: PageActionsResult<SearchResultsParsed[]> = {
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


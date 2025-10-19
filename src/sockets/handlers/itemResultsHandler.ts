import { Socket } from 'socket.io';
import { Logger } from 'winston';
import { getItemResultsParams } from '../../types/search.types.js';
import { universalSupplierHandler } from './universalSupplierHandler.js';

/**
 * Обновленная фабричная функция.
 * Теперь она просто возвращает асинхронную функцию, которая вызывает
 * новый универсальный обработчик. Вся сложная логика инкапсулирована в нем.
 */
export const createItemResultsHandler = (
  socket: Socket,
  userLogger: Logger
) => {
  /**
   * Возвращаем функцию, которая полностью соответствует старому контракту,
   * но внутри себя просто вызывает новый универсальный обработчик.
   */
  return async (data: getItemResultsParams) => {
    // Вся логика из десятков строк кода сжимается до одного вызова:
    await universalSupplierHandler(socket, data, userLogger);
  };
};

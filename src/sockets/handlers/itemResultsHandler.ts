import { Socket } from 'socket.io';
import { Logger } from 'winston';
import { getItemResultsParams } from '../../types/search.types.js';
import { universalSupplierHandler } from './universalSupplierHandler.js';

export const createItemResultsHandler = (
  socket: Socket,
  userLogger: Logger
) => {
  return async (data: getItemResultsParams) => {
    await universalSupplierHandler(socket, data, userLogger);
  };
};

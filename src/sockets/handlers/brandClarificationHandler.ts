import { Socket } from 'socket.io';
import { Logger } from 'winston';
import { SOCKET_EVENTS } from '../../constants/socketEvents.js';
import { clarifyBrand } from '../../services/clarifyBrand.js';
import { ClarifyBrandResult } from '../../types/brand.types.js';

export const createBrandClarificationHandler = (
  socket: Socket,
  userLogger: Logger
) => {
  return async (data: { query: string }) => {
    const { query } = data;
    userLogger.info(`Received BRAND_CLARIFICATION event for query: "${query}"`);

    if (!query || query.trim() === '') {
      socket.emit(SOCKET_EVENTS.BRAND_CLARIFICATION_RESULTS, {
        query: '',
        results: [],
      });
      return;
    }

    try {
      const result: ClarifyBrandResult = await clarifyBrand(query, userLogger);

      if (result.success) {
        userLogger.info(
          `BRAND_CLARIFICATION success, found: ${result.brands.length}`
        );
        socket.emit(SOCKET_EVENTS.BRAND_CLARIFICATION_RESULTS, {
          brands: result.brands,
          message: result.message,
        });
      } else {
        userLogger.error(`BRAND_CLARIFICATION failed:`, result.message);
        socket.emit(SOCKET_EVENTS.BRAND_CLARIFICATION_ERROR, {
          message: result.message,
        });
      }
    } catch (error) {
      const errorMessage = `Error clarifying brand: ${(error as Error).message}`;
      userLogger.error('Brand Clarification error:', error);
      socket.emit(SOCKET_EVENTS.BRAND_CLARIFICATION_ERROR, {
        message: errorMessage,
      });
    }
  };
};

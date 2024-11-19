import chalk from 'chalk';
import { CLIENT_URL } from 'config';
import { logger } from 'config/logger';
import { Server as HTTPServer } from 'http';
import { patriotPageActionsService } from 'services/pages/patriotPageActionsService';
import { turboCarsPageActionsService } from 'services/pages/turboCarsPageActionsService';
import { ugPageActionsService } from 'services/pages/ugPageActionsService';
import { getItemsListByArticleService } from 'services/profit/getItemsListByArticleService';
import { getItemsWithRest } from 'services/profit/getItemsWithRest';
import { Server as SocketIOServer } from 'socket.io';
import {
  accountAlias,
  ItemToParallelSearch,
  PageAction,
  pageActionsResult,
  PuppeteerSupplierName,
  SupplierName,
} from 'types';
import { isBrandMatch } from 'utils/data/isBrandMatch';
import { parseProfitApiResponse } from 'utils/data/profit/parseProfitApiResponse';
import { SOCKET_EVENTS } from '../constants/socketEvents';
import { sessionManager } from '../session/sessionManager';
import { logResultCount } from '../utils/stdLogs';

const supplierServices: {
  [key in PuppeteerSupplierName]: (
    actionParams: PageAction
  ) => Promise<pageActionsResult>;
} = {
  ug: ugPageActionsService,
  turboCars: turboCarsPageActionsService,
  patriot: patriotPageActionsService,
};

export const initializeSocket = (server: HTTPServer) => {
  const io = new SocketIOServer(server, {
    cors: {
      origin: CLIENT_URL,
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', async (socket) => {
    logger.info(chalk.cyan(`New client connected: ${socket.id}`));

    try {
      const sessions = await sessionManager.createSessionsForSocket(socket.id);
      logger.info(`Sessions created for socket ${socket.id}:`, sessions);
      socket.emit(
        SOCKET_EVENTS.SESSIONS_CREATED,
        sessions.map((session) => ({
          sessionID: session.sessionID,
          supplier: session.supplier,
          accountAlias: session.accountAlias,
        }))
      );
    } catch (error) {
      logger.error(
        `Error creating sessions for socket ${socket.id}: ${(error as Error).message}`
      );

      socket.emit(SOCKET_EVENTS.SESSIONS_ERROR, {
        message: 'Error creating sessions',
      });
    }

    // AUTOCOMPLETE Handler
    socket.on(SOCKET_EVENTS.AUTOCOMPLETE, async (data) => {
      console.log(chalk.cyan(JSON.stringify(data)));
      const { sessionID, query, accountAlias } = data;
      const sessionKey = accountAlias ? `ug_${accountAlias}` : 'ug';

      if (!query || query.trim() === '') {
        socket.emit(SOCKET_EVENTS.AUTOCOMPLETE_RESULTS, {
          query: '',
          results: [],
          sessionID,
          accountAlias,
        });
        return;
      }

      try {
        const session = sessionManager.getSession(socket.id, sessionKey);
        if (!session) {
          throw new Error('Session not found');
        }

        const results = await ugPageActionsService({
          action: SOCKET_EVENTS.AUTOCOMPLETE,
          query,
          supplier: 'ug',
          sessionID: session.sessionID,
          accountAlias,
        });
        socket.emit(SOCKET_EVENTS.AUTOCOMPLETE_RESULTS, {
          query,
          results,
          sessionID: session.sessionID,
          accountAlias,
        });
      } catch (error) {
        logger.error('Autocomplete error:', error);
        console.error(`Autocomplete error for session ${sessionID}:`, error);
        socket.emit(SOCKET_EVENTS.AUTOCOMPLETE_ERROR, {
          query,
          message: (error as Error).message,
          sessionID,
          accountAlias,
        });
      }
    });

    // BRAND_CLARIFICATION Handler
    socket.on(SOCKET_EVENTS.BRAND_CLARIFICATION, async (data) => {
      console.log(
        `Received BRAND_CLARIFICATION event from socket ${socket.id}:`,
        data
      );
      const { sessionID, query } = data;

      if (!query || query.trim() === '') {
        console.log(
          `Empty query received for BRAND_CLARIFICATION from socket ${socket.id}, sessionID: ${sessionID}`
        );
        socket.emit(SOCKET_EVENTS.BRAND_CLARIFICATION_RESULTS, {
          query: '',
          results: [],
          sessionID,
        });
        return;
      }

      try {
        console.log(
          `Processing BRAND_CLARIFICATION for query "${query}" in session ${sessionID}`
        );
        const result = await ugPageActionsService({
          action: 'clarifyBrand',
          query,
          supplier: 'ug',
          sessionID,
        });

        if (result.success) {
          console.log(
            `BRAND_CLARIFICATION success for session ${sessionID}:`,
            result.data
          );
          socket.emit(SOCKET_EVENTS.BRAND_CLARIFICATION_RESULTS, {
            brands: result.data,
            message: result.message,
            sessionID,
          });
        } else {
          console.log(
            `BRAND_CLARIFICATION failed for session ${sessionID}:`,
            result.message
          );
          socket.emit(SOCKET_EVENTS.BRAND_CLARIFICATION_ERROR, {
            message: result.message,
            sessionID,
          });
        }
      } catch (error) {
        logger.error('Brand Clarification error:', error);
        console.error(
          `Brand Clarification error for session ${sessionID}:`,
          error
        );
        socket.emit(SOCKET_EVENTS.BRAND_CLARIFICATION_ERROR, {
          message: `Error clarifying brand: ${(error as Error).message}`,
          sessionID,
        });
      }
    });

    // GET_ITEM_RESULTS Handler
    interface getItemResultsParams {
      sessionID?: string;
      item: ItemToParallelSearch;
      accountAlias?: accountAlias;
      supplier?: SupplierName;
    }
    socket.on(
      SOCKET_EVENTS.GET_ITEM_RESULTS,
      async (data: getItemResultsParams) => {
        console.log(
          `Received GET_ITEM_RESULTS event from socket ${socket.id}:`,
          data
        );
        const { sessionID, item, supplier, accountAlias } = data;

        if (!supplier) {
          console.error('Supplier is undefined in GET_ITEM_RESULTS');
          return;
        }

        if (sessionID && supplier) {
          const sessionKey = accountAlias
            ? `${supplier}_${accountAlias}`
            : supplier;

          const session = sessionManager.getSession(socket.id, sessionKey);
        }

        if (supplier === 'profit') {
          // Handle 'profit' supplier without session
          try {
            console.log(`Fetching data from 'profit' for item:`, item);
            socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_STARTED, {
              supplier: 'profit',
              article: item.article,
            });

            // Fetch data from 'profit' API
            const data = await getItemsListByArticleService(item.article);
            const itemsWithRest = await getItemsWithRest(data);
            const relevantItems = itemsWithRest.filter(({ brand }: any) =>
              isBrandMatch(item.brand, brand)
            );

            const profitParsedData = parseProfitApiResponse(
              relevantItems,
              item.brand
            );

            logResultCount(item, supplier, profitParsedData);

            const profitResult: pageActionsResult = {
              success: profitParsedData.length > 0,
              message: `Profit data fetched: ${profitParsedData.length > 0}`,
              data: profitParsedData,
            };

            socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_SUCCESS, {
              supplier: 'profit',
              result: profitResult,
            });
          } catch (error) {
            logger.error('Profit error:', error);
            socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_ERROR, {
              supplier: 'profit',
              error: (error as Error).message,
            });
          }
        } else {
          try {
            socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_STARTED, {
              supplier,
              sessionID,
              accountAlias,
            });
            if (supplier && sessionID) {
              const result = await supplierServices[supplier]({
                action: 'pick',
                item,
                supplier,
                sessionID,
                accountAlias,
              });

              socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_SUCCESS, {
                supplier,
                result,
                sessionID,
                accountAlias,
              });
            }
          } catch (error) {
            logger.error(`Error fetching from ${supplier}: ${error}`);
            socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_ERROR, {
              supplier,
              error: (error as Error).message,
              sessionID,
              accountAlias,
            });
          }
        }
      }
    );

    socket.on(SOCKET_EVENTS.ADD_TO_CART_REQUEST, async (data) => {
      const { count, item, sessionID, accountAlias } = data;

      const supplier = item.supplier;
      const sessionKey = `${supplier}_${accountAlias}`;

      const session = sessionManager.getSession(socket.id, sessionKey);
      if (!session) {
        throw new Error('Session not found');
      }

      try {
        let result;
        const supplierName = supplier as SupplierName;

        if (supplierName === 'turboCars') {
          result = await turboCarsPageActionsService({
            action: 'addToCart',
            supplier: supplierName,
            count,
            item,
            sessionID,
            accountAlias,
          });
        } else if (supplierName === 'ug' || supplierName === 'patriot') {
          result = await ugPageActionsService({
            action: 'addToCart',
            supplier: supplierName,
            count,
            item,
            sessionID,
            accountAlias,
          });
        }

        if (result?.success) {
          socket.emit(SOCKET_EVENTS.ADD_TO_CART_SUCCESS, {
            result,
            sessionID,
            accountAlias,
          });
        } else {
          socket.emit(SOCKET_EVENTS.ADD_TO_CART_ERROR, {
            message: result?.message,
            sessionID,
            accountAlias,
          });
        }
      } catch (error) {
        logger.error(`Error in ADD_TO_CART_REQUEST:`, error);

        socket.emit(SOCKET_EVENTS.ADD_TO_CART_ERROR, {
          message: (error as Error).message,
          sessionID,
          accountAlias,
        });
      }
    });

    // Disconnect Handler
    socket.on('disconnect', () => {
      logger.info(chalk.bgCyan(`Client disconnected: ${socket.id}`));
      console.log(`Socket disconnected: ${socket.id}`);
      sessionManager.closeSessionsForSocket(socket.id);
      console.log(`Closed sessions for socket ${socket.id}`);
    });
  });
};

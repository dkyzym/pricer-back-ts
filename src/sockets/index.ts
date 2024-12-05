import chalk from 'chalk';
import { CLIENT_URL } from 'config';
import { logger } from 'config/logger';
import { Server as HTTPServer } from 'http';
import { turboCarsPageActionsService } from 'services/pages/turboCarsPageActionsService';
import { ugPageActionsService } from 'services/pages/ugPageActionsService';
import { getItemsListByArticleService } from 'services/profit/getItemsListByArticleService';
import { getItemsWithRest } from 'services/profit/getItemsWithRest';
import { Server as SocketIOServer } from 'socket.io';
import {
  ItemToParallelSearch,
  pageActionsResult,
  // PuppeteerSupplierName,
  SupplierName,
} from 'types';
import { isBrandMatch } from 'utils/data/isBrandMatch';
import { parseProfitApiResponse } from 'utils/data/profit/parseProfitApiResponse';
import { SOCKET_EVENTS } from '../constants/socketEvents';
import { itemDataPatriotService } from '../services/patriot/itemDataPatriotService';
import { fetchUgData } from '../services/ug/fetchUgData/fetchUgData';
import { mapUgResponseData } from '../services/ug/mapUgResponseData';
import { sessionManager } from '../session/sessionManager';
import { parseAutosputnikData } from '../utils/data/autosputnik/parseAutosputnikData';
import { logResultCount } from '../utils/stdLogs';

// const supplierServices: {
//   [key in PuppeteerSupplierName]: (
//     actionParams: PageAction
//   ) => Promise<pageActionsResult>;
// } = {
//   // ug: ugPageActionsService,
//   // turboCars: turboCarsPageActionsService,
//   patriot: patriotPageActionsService,
// };

export const initializeSocket = (server: HTTPServer) => {
  const io = new SocketIOServer(server, {
    cors: {
      origin: CLIENT_URL,
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', async (socket) => {
    logger.info(chalk.cyan(`New client connected: ${socket.id}`));

    socket.emit(SOCKET_EVENTS.CONNECT, { message: 'Connected to server' });

    // AUTOCOMPLETE Handler
    // socket.on(SOCKET_EVENTS.AUTOCOMPLETE, async (data) => {
    //   console.log(chalk.cyan(JSON.stringify(data)));
    //   const { sessionID, query, accountAlias } = data;
    //   const sessionKey = accountAlias ? `ug_${accountAlias}` : 'ug';

    //   if (!query || query.trim() === '') {
    //     socket.emit(SOCKET_EVENTS.AUTOCOMPLETE_RESULTS, {
    //       query: '',
    //       results: [],
    //       sessionID,
    //       accountAlias,
    //     });
    //     return;
    //   }

    //   try {
    //     const session = sessionManager.getSession(socket.id, sessionKey);
    //     if (!session) {
    //       throw new Error('Session not found');
    //     }

    //     const results = await ugPageActionsService({
    //       action: SOCKET_EVENTS.AUTOCOMPLETE,
    //       query,
    //       supplier: 'ug',
    //       sessionID: session.sessionID,
    //       accountAlias,
    //     });
    //     socket.emit(SOCKET_EVENTS.AUTOCOMPLETE_RESULTS, {
    //       query,
    //       results,
    //       sessionID: session.sessionID,
    //       accountAlias,
    //     });
    //   } catch (error) {
    //     logger.error('Autocomplete error:', error);
    //     console.error(`Autocomplete error for session ${sessionID}:`, error);
    //     socket.emit(SOCKET_EVENTS.AUTOCOMPLETE_ERROR, {
    //       query,
    //       message: (error as Error).message,
    //       sessionID,
    //       accountAlias,
    //     });
    //   }
    // });

    // BRAND_CLARIFICATION Handler
    // socket.on(SOCKET_EVENTS.BRAND_CLARIFICATION, async (data) => {
    //   console.log(
    //     `Received BRAND_CLARIFICATION event from socket ${socket.id}:`,
    //     data
    //   );
    //   const { sessionID, query } = data;

    //   if (!query || query.trim() === '') {
    //     console.log(
    //       `Empty query received for BRAND_CLARIFICATION from socket ${socket.id}, sessionID: ${sessionID}`
    //     );
    //     socket.emit(SOCKET_EVENTS.BRAND_CLARIFICATION_RESULTS, {
    //       query: '',
    //       results: [],
    //       sessionID,
    //     });
    //     return;
    //   }

    //   try {
    //     console.log(
    //       `Processing BRAND_CLARIFICATION for query "${query}" in session ${sessionID}`
    //     );
    //     const result = await ugPageActionsService({
    //       action: 'clarifyBrand',
    //       query,
    //       supplier: 'ug',
    //       sessionID,
    //     });

    //     if (result.success) {
    //       console.log(
    //         `BRAND_CLARIFICATION success for session ${sessionID}:`,
    //         result.data
    //       );
    //       socket.emit(SOCKET_EVENTS.BRAND_CLARIFICATION_RESULTS, {
    //         brands: result.data,
    //         message: result.message,
    //         sessionID,
    //       });
    //     } else {
    //       console.log(
    //         `BRAND_CLARIFICATION failed for session ${sessionID}:`,
    //         result.message
    //       );
    //       socket.emit(SOCKET_EVENTS.BRAND_CLARIFICATION_ERROR, {
    //         message: result.message,
    //         sessionID,
    //       });
    //     }
    //   } catch (error) {
    //     logger.error('Brand Clarification error:', error);
    //     console.error(
    //       `Brand Clarification error for session ${sessionID}:`,
    //       error
    //     );
    //     socket.emit(SOCKET_EVENTS.BRAND_CLARIFICATION_ERROR, {
    //       message: `Error clarifying brand: ${(error as Error).message}`,
    //       sessionID,
    //     });
    //   }
    // });

    // GET_ITEM_RESULTS Handler
    interface getItemResultsParams {
      // sessionID?: string;
      item: ItemToParallelSearch;
      // accountAlias?: accountAlias;
      supplier: SupplierName;
    }
    socket.on(
      SOCKET_EVENTS.GET_ITEM_RESULTS,
      async (data: getItemResultsParams) => {
        console.log(
          `Received GET_ITEM_RESULTS event from socket ${socket.id}:`,
          data
        );
        const { item, supplier } = data;
        console.log(chalk.bgGreenBright('supplier ', supplier));
        if (!supplier) {
          console.error('Supplier is undefined in GET_ITEM_RESULTS');
          return;
        }

        if (supplier === 'profit') {
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
        } else if (supplier === 'autosputnik') {
          try {
            console.log(`Fetching data from 'autosputnik' for item:`, item);
            socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_STARTED, {
              supplier: 'autosputnik',
              article: item.article,
            });

            const data = await parseAutosputnikData(item);

            const autosputnikResult: pageActionsResult = {
              success: true,
              message: `Autosputnik data fetched: ${data?.length}`,
              data: [
                // {
                //   id: '123456',
                //   article: 'ART123',
                //   brand: 'BrandX',
                //   description: 'High-quality car part for optimal performance.',
                //   availability: 25,
                //   price: 99.99,
                //   warehouse: 'Main Warehouse',
                //   imageUrl: 'https://example.com/image.jpg',
                //   deadline: 2,
                //   deadLineMax: 5,
                //   supplier: 'autosputnik',
                //   probability: 0.85,
                //   needToCheckBrand: true,
                //   innerId: 'INNER123',
                //   deadLineTimeToOrder: '2024-12-25T12:00:00Z',
                //   deliveryDate: '2024-12-30',
                //   returnable: 1,
                //   multi: 5,
                //   allow_return: 'yes',
                //   warehouse_id: 'WH123',
                //   inner_product_code: 'PRD456',
                // },
              ],
            };

            socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_SUCCESS, {
              supplier: 'autosputnik',
              result: autosputnikResult,
            });
          } catch (error) {
            logger.error('Autosputnik error:', error);
            socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_ERROR, {
              supplier: 'autosputnik',
              error: (error as Error).message,
            });
          }
        } else if (supplier === 'ug') {
          try {
            console.log(`Fetching data from 'ug' for item:`, item);
            socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_STARTED, {
              supplier: 'ug',
              article: item.article,
            });

            const data = await fetchUgData(item.article, item.brand);

            const mappedUgResponseData = mapUgResponseData(data, item.brand);

            logResultCount(item, supplier, mappedUgResponseData);

            const ugResult: pageActionsResult = {
              success: mappedUgResponseData.length > 0,
              message: `Ug data fetched: ${mappedUgResponseData.length > 0}`,
              data: mappedUgResponseData,
            };

            socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_SUCCESS, {
              supplier: 'ug',
              result: ugResult,
            });
          } catch (error) {
            logger.error('Ug error:', error);
            socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_ERROR, {
              supplier: 'ug',
              error: (error as Error).message,
            });
          }
        } else if (supplier === 'patriot') {
          try {
            console.log(`Fetching data from patriot' for item:`, item);
            socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_STARTED, {
              supplier: 'patriot',
              article: item.article,
            });

            const data = await itemDataPatriotService({ item, supplier });

            logResultCount(item, supplier, data);

            const patriotResult: pageActionsResult = {
              success: data.length > 0,
              message: `Patriot data fetched: ${data.length > 0}`,
              data: data,
            };

            socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_SUCCESS, {
              supplier: 'patriot',
              result: patriotResult,
            });
          } catch (error) {
            logger.error('Patriot error:', error);
            socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_ERROR, {
              supplier: 'patriot',
              error: (error as Error).message,
            });
          }
        } else if (supplier === 'turboCars') {
          console.log('тут будет код turboCars');
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
      console.log(`Closed sessions for socket ${socket.id}`);
    });
  });
};

import chalk from 'chalk';
import { CLIENT_URL } from 'config';
import { logger } from 'config/logger';
import { Server as HTTPServer } from 'http';
import { getItemsListByArticleService } from 'services/profit/getItemsListByArticleService';
import { getItemsWithRest } from 'services/profit/getItemsWithRest';
import { Server as SocketIOServer } from 'socket.io';
import {
  ClarifyBrandResult,
  ItemToParallelSearch,
  pageActionsResult,
  SupplierName,
} from 'types';
import { isBrandMatch } from 'utils/data/isBrandMatch';
import { parseProfitApiResponse } from 'utils/data/profit/parseProfitApiResponse';
import { SOCKET_EVENTS } from '../constants/socketEvents';
import { itemDataAutoImpulseService } from '../services/autoimpulse/itemDataAutoImpulseService';
import { clarifyBrand } from '../services/clarifyBrand';
import { itemDataPatriotService } from '../services/patriot/itemDataPatriotService';
import { searchTurbocarsCode } from '../services/turboCars/api/searchTurboCarsCode';
import { fetchUgData } from '../services/ug/fetchUgData/fetchUgData';
import { mapUgResponseData } from '../services/ug/mapUgResponseData';
import { parseAutosputnikData } from '../utils/data/autosputnik/parseAutosputnikData';
import { parseXmlToSearchResults } from '../utils/mapData/mapTurboCarsData';
import { logResultCount } from '../utils/stdLogs';

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

    // BRAND_CLARIFICATION Handler
    socket.on(SOCKET_EVENTS.BRAND_CLARIFICATION, async (data) => {
      logger.info(
        `Received BRAND_CLARIFICATION event from socket ${socket.id}:`,
        data
      );
      const { query } = data;

      if (!query || query.trim() === '') {
        console.log(
          `Empty query received for BRAND_CLARIFICATION from socket ${socket.id}`
        );
        socket.emit(SOCKET_EVENTS.BRAND_CLARIFICATION_RESULTS, {
          query: '',
          results: [],
        });
        return;
      }

      try {
        logger.info(`Processing BRAND_CLARIFICATION for query "${query}"`);

        const result: ClarifyBrandResult = await clarifyBrand(query);

        if (result.success) {
          console.log(
            `BRAND_CLARIFICATION success, found:`,
            result.brands.length
          );
          socket.emit(SOCKET_EVENTS.BRAND_CLARIFICATION_RESULTS, {
            brands: result.brands,
            message: result.message,
          });
        } else {
          logger.error(`BRAND_CLARIFICATION failed `, result.message);
          socket.emit(SOCKET_EVENTS.BRAND_CLARIFICATION_ERROR, {
            message: result.message,
          });
        }
      } catch (error) {
        logger.error('Brand Clarification error:', error);
        socket.emit(SOCKET_EVENTS.BRAND_CLARIFICATION_ERROR, {
          message: `Error clarifying brand: ${(error as Error).message}`,
        });
      }
    });

    // GET_ITEM_RESULTS Handler
    interface getItemResultsParams {
      item: ItemToParallelSearch;
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

            const autoSputnikData = await parseAutosputnikData(item);

            logResultCount(item, supplier, autoSputnikData);

            const autosputnikResult: pageActionsResult = {
              success: true,
              message: `Autosputnik data fetched: ${autoSputnikData?.length}`,
              data: autoSputnikData,
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
        } else if (supplier === 'autoImpulse') {
          try {
            console.log(`Fetching data from ${supplier}' for item:`, item);
            socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_STARTED, {
              supplier,
              article: item.article,
            });

            const data = await itemDataAutoImpulseService({ item, supplier });

            logResultCount(item, supplier, data);

            const autoImpulseResult: pageActionsResult = {
              success: data.length > 0,
              message: `AutoImpulse data fetched: ${data.length > 0}`,
              data: data,
            };

            socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_SUCCESS, {
              supplier,
              result: autoImpulseResult,
            });
          } catch (error) {
            logger.error('AutoImpulse error:', error);
            socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_ERROR, {
              supplier,
              error: (error as Error).message,
            });
          }
        } else if (supplier === 'turboCars') {
          try {
            console.log(`Fetching data from ${supplier}' for item:`, item);
            socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_STARTED, {
              supplier: supplier,
              article: item.article,
            });

            const withAnalogs = 0;
            const codeSearchResult = await searchTurbocarsCode(item.article);
            const data = parseXmlToSearchResults(
              codeSearchResult,
              item.brand,
              withAnalogs
            );

            logResultCount(item, supplier, data);

            const turboCarsResult: pageActionsResult = {
              success: data.length > 0,
              message: `Patriot data fetched: ${data.length > 0}`,
              data: data,
            };

            socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_SUCCESS, {
              supplier: 'turboCars',
              result: turboCarsResult,
            });
          } catch (error) {
            logger.error('TurboCars error:', error);
            socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_ERROR, {
              supplier: 'turboCars',
              error: (error as Error).message,
            });
          }
        }
      }
    );

    // Disconnect Handler
    socket.on('disconnect', () => {
      logger.info(chalk.bgCyan(`Client disconnected: ${socket.id}`));
      console.log(`Socket disconnected: ${socket.id}`);
      console.log(`Closed sessions for socket ${socket.id}`);
    });
  });
};

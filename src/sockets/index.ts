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
  ItemToParallelSearch,
  PageAction,
  pageActionsResult,
  PuppeteerSupplierName,
  SupplierName,
} from 'types';
import { isBrandMatch } from 'utils/data/isBrandMatch';
import { parseProfitApiResponse } from 'utils/data/profit/parseProfitApiResponse';
import { logResultCount } from 'utils/stdLogs';
import { SOCKET_EVENTS } from '../constants/socketEvents';

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

  io.on('connection', (socket) => {
    logger.info(chalk.cyan(`New client connected: ${socket.id}`));

    socket.on(SOCKET_EVENTS.AUTOCOMPLETE, async (query: string) => {
      if (!query || query.trim() === '') {
        socket.emit(SOCKET_EVENTS.AUTOCOMPLETE_RESULTS, {
          query: '',
          results: [],
        });
        return;
      }

      try {
        const results = await ugPageActionsService({
          action: SOCKET_EVENTS.AUTOCOMPLETE,
          query,
          supplier: 'ug',
        });
        socket.emit(SOCKET_EVENTS.AUTOCOMPLETE_RESULTS, { query, results });
      } catch (error) {
        logger.error('Autocomplete error:', error);
        socket.emit(SOCKET_EVENTS.AUTOCOMPLETE_ERROR, {
          query,
          message: error,
        });
      }
    });

    socket.on(SOCKET_EVENTS.BRAND_CLARIFICATION, async (query: string) => {
      try {
        const result = await ugPageActionsService({
          action: 'clarifyBrand',
          query,
          supplier: 'ug',
        });

        if (result.success) {
          socket.emit(SOCKET_EVENTS.BRAND_CLARIFICATION_RESULTS, {
            brands: result.data,
            message: result.message,
          });
        } else {
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

    socket.on(
      SOCKET_EVENTS.GET_ITEM_RESULTS,
      async (item: ItemToParallelSearch) => {
        logger.info(
          chalk.bgGreenBright(
            `${'[supplierDataFetchStarted] - Искали это: \n'}${JSON.stringify(item, null, 2)})`
          )
        );
        const fetchProfitData = async () => {
          try {
            socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_STARTED, {
              supplier: 'profit',
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

            logResultCount(item, 'profit', profitParsedData);

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
        };

        const fetchSuppliersData = async () => {
          const suppliers: PuppeteerSupplierName[] = [
            'ug',
            'turboCars',
            'patriot',
          ];

          const supplierPromises = suppliers.map(async (supplier) => {
            try {
              socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_STARTED, {
                supplier,
              });
              const result = await supplierServices[supplier]({
                action: 'pick',
                item,
                supplier,
              });
              socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_SUCCESS, {
                supplier,
                result,
              });
            } catch (error) {
              logger.error(`Error fetching from ${supplier}: ${error}`);
              socket.emit(SOCKET_EVENTS.SUPPLIER_DATA_FETCH_ERROR, {
                supplier,
                error: (error as Error).message,
              });
            }
          });

          await Promise.allSettled(supplierPromises);
        };

        fetchProfitData();
        fetchSuppliersData();
      }
    );

    socket.on(SOCKET_EVENTS.ADD_TO_CART_REQUEST, async (data) => {
      const { count, item } = data;
      const supplier = item.supplier;

      try {
        let result;
        const supplierName = supplier as SupplierName;

        if (supplierName === 'turboCars') {
          result = await turboCarsPageActionsService({
            action: 'addToCart',
            supplier: supplierName,
            count,
            item,
          });
        } else if (supplierName === 'ug' || supplierName === 'patriot') {
          /*используем один сервис для ЮГ и Патриот так как
           функции парсинга и добавления в корзину идентичны
           и чтобы пока не создавать карту и усложнять не код */
          result = await ugPageActionsService({
            action: 'addToCart',
            supplier: supplierName,
            count,
            item,
          });
        }

        if (result?.success) {
          socket.emit(SOCKET_EVENTS.ADD_TO_CART_SUCCESS, result);
        } else {
          socket.emit(SOCKET_EVENTS.ADD_TO_CART_ERROR, {
            message: result?.message,
          });
        }
      } catch (error) {
        console.error(`Error in ADD_TO_CART_REQUEST:`, error);
        socket.emit(SOCKET_EVENTS.ADD_TO_CART_ERROR, {
          message: (error as Error).message,
        });
      }
    });

    socket.on('disconnect', () => {
      logger.info(chalk.bgCyan(`Client disconnected: ${socket.id}`));
    });
  });
};

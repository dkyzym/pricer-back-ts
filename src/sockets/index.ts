import chalk from 'chalk';
import { CLIENT_URL } from 'config';
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
  SearchResult,
  SupplierName,
} from 'types';
import { isBrandMatch } from 'utils/data/isBrandMatch';
import { parseApiResponse } from 'utils/data/profit/parseApiResponse';

const supplierServices: {
  [key in SupplierName]: (
    actionParams: PageAction
  ) => Promise<pageActionsResult>;
} = {
  ug: ugPageActionsService,
  turboCars: turboCarsPageActionsService,
  patriot: patriotPageActionsService,
  profit: patriotPageActionsService, // need to fix
};
// TODO brand names
// allSettled

export const initializeSocket = async (server: HTTPServer) => {
  const io = new SocketIOServer(server, {
    cors: {
      origin: CLIENT_URL,
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`New client connected: ${socket.id}`);

    socket.on('autocomplete', async (query: string) => {
      try {
        const results = await ugPageActionsService({
          action: 'autocomplete',
          query,
          supplier: 'ug',
        });
        socket.emit('autocompleteResults', { query, results });
      } catch (error) {
        console.error('Autocomplete error:', error);
        socket.emit('autocompleteError', { query, message: error });
      }
    });

    socket.on('getItemResults', async (item: ItemToParallelSearch) => {
      try {
        let results: SearchResult[] = [];

        const fetchProfitData = async () => {
          try {
            const data = await getItemsListByArticleService(item.article);
            const itemsWithRest = await getItemsWithRest(data);
            const relevantItems = itemsWithRest.filter(({ brand }: any) => {
              return isBrandMatch(item.brand, brand);
            });
            const profitParsedData = parseApiResponse(
              relevantItems,
              item.brand
            );

            if (profitParsedData.length > 0) {
              console.log(
                chalk.bgYellowBright(
                  `Найдено результатов перед возвратом ${'Profit'}:  ${profitParsedData?.length}`
                )
              );
            } else {
              console.log(chalk.bgYellowBright('No profit data found.'));
            }

            const profitResult: pageActionsResult = {
              success: profitParsedData.length > 0,
              message: `Profit data fetched: ${profitParsedData.length > 0}`,
              data: profitParsedData,
            };

            results.push({ supplier: 'profit', result: profitResult });
          } catch (error) {
            console.error('Profit error:', error);

            socket.emit('autocompleteError', {
              message: `Error occurred while fetching item results from profit: ${(error as Error).message}`,
            });
          }
        };

        const fetchSuppliersData = async () => {
          const suppliers: SupplierName[] = ['patriot'];

          const supplierPromises = suppliers.map(async (supplier) => {
            try {
              const result = await supplierServices[supplier]({
                action: 'pick',
                item,
                supplier,
              });
              return { supplier, result };
            } catch (error) {
              console.error(
                chalk.red(`Error fetching from ${supplier}:`, error)
              );
              socket.emit('autocompleteError', {
                message: `Error occurred while fetching item results from ${supplier}: ${(error as Error).message}`,
              });
              return { supplier, result: null };
            }
          });

          const suppliersResults = await Promise.all(supplierPromises);
          results.push(...suppliersResults);
        };

        await Promise.all([fetchProfitData(), fetchSuppliersData()]);

        results.forEach(({ supplier, result }) => {
          if (result && result.success) {
            socket.emit('getItemResultsData', { supplier, result });
          } else {
            console.log(
              chalk.red(
                `Ошибка при получении данных от ${supplier}: ${result?.message}`
              )
            );
            socket.emit('autocompleteError', {
              message: `Ошибка при получении данных от ${supplier}: ${result?.message}`,
            });
          }
        });
      } catch (error) {
        console.error(chalk.bgRed((error as Error).message));
        socket.emit('autocompleteError', {
          message: 'General error occurred while fetching item results',
        });
      }
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
};

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
  PuppeteerSupplierName,
} from 'types';
import { isBrandMatch } from 'utils/data/isBrandMatch';
import { parseApiResponse } from 'utils/data/profit/parseApiResponse';
import { logWithRandomBackground } from 'utils/log';

/**
 * TODO
 * fix brand names search
 * fix profit time to delivery
 * https://turbo-cars.net/office/SECURE.asp secure?
 */

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

    socket.on('getBrandClarification', async (query: string) => {
      try {
        const result = await ugPageActionsService({
          action: 'clarifyBrand',
          query,
          supplier: 'ug',
        });

        if (result.success && result.data) {
          socket.emit('brandClarificationResults', {
            brands: result.data,
          });
        } else {
          socket.emit('brandClarificationError', {
            message: result.message,
          });
        }
      } catch (error) {
        console.error('Brand Clarification error:', error);
        socket.emit('brandClarificationError', {
          message: `Error clarifying brand: ${(error as Error).message}`,
        });
      }
    });

    socket.on('getItemResults', async (item: ItemToParallelSearch) => {
      const fetchProfitData = async () => {
        try {
          const data = await getItemsListByArticleService(item.article);
          const itemsWithRest = await getItemsWithRest(data);
          const relevantItems = itemsWithRest.filter(({ brand }: any) =>
            isBrandMatch(item.brand, brand)
          );
          const profitParsedData = parseApiResponse(relevantItems, item.brand);

          logWithRandomBackground(
            `Найдено результатов перед возвратом ${'profit'}:  ${profitParsedData.length}`
          );

          const profitResult: pageActionsResult = {
            success: profitParsedData.length > 0,
            message: `Profit data fetched: ${profitParsedData.length > 0}`,
            data: profitParsedData,
          };

          socket.emit('getItemResultsData', {
            supplier: 'profit',
            result: profitResult,
          });
        } catch (error) {
          console.error('Profit error:', error);
          socket.emit('autocompleteError', {
            message: `Error fetching data from profit: ${(error as Error).message}`,
          });
        }
      };

      const fetchSuppliersData = async () => {
        const suppliers: PuppeteerSupplierName[] = [
          'ug',
          'turboCars',
          // 'patriot',
        ];

        const supplierPromises = suppliers.map(async (supplier) => {
          try {
            const result = await supplierServices[supplier]({
              action: 'pick',
              item,
              supplier,
            });
            socket.emit('getItemResultsData', { supplier, result });
          } catch (error) {
            console.error(chalk.red(`Error fetching from ${supplier}:`, error));
            socket.emit('autocompleteError', {
              message: `Error fetching data from ${supplier}: ${(error as Error).message}`,
            });
          }
        });

        await Promise.allSettled(supplierPromises);
      };

      fetchProfitData();
      fetchSuppliersData();
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
};

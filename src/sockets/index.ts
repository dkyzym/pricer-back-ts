import chalk from 'chalk';
import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { CLIENT_URL } from '../config';
import { patriotPageActionsService } from '../services/pages/patriotPageActionsService';
import { turboCarsPageActionsService } from '../services/pages/turboCarsPageActionsService';
import { ugPageActionsService } from '../services/pages/ugPageActionsService';
import { PageAction, pageActionsResult, SupplierName } from '../types';

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

    socket.on('getItemResults', async (item) => {
      try {
        socket.emit(chalk.bgBlue('startLoading'));

        // const suppliers: SupplierName[] = ['ug', 'turboCars', 'patriot'];
        const suppliers: SupplierName[] = ['patriot'];

        const results = await Promise.all(
          suppliers.map(async (supplier) => {
            try {
              const result = await supplierServices[supplier]({
                action: 'pick',
                item,
                supplier,
              });
              return { supplier, result };
            } catch (error) {
              console.log(chalk.red(`Error fetching from ${supplier}:`, error));
              socket.emit('autocompleteError', {
                message: `Error occurred while fetching item results from ${supplier}`,
              });
              return { supplier, result: null };
            }
          })
        );

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
        console.log(chalk.bgRed((error as Error).message));
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

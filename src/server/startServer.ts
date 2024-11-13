import chalk from 'chalk';
import { PORT } from 'config';
import { logger } from 'config/logger';
import type { Application } from 'express';
import { Server as HTTPServer } from 'http';
import { AddressInfo } from 'net';
import { ugPageActionsService } from 'services/pages/ugPageActionsService';
import { initializeSocket } from 'sockets';
import { closeAllResources } from '../services/browserManager';
import { patriotPageActionsService } from '../services/pages/patriotPageActionsService';
import { turboCarsPageActionsService } from '../services/pages/turboCarsPageActionsService';

// В файле, где вы инициализируете сервер

export const startServer = async (app: Application) => {
  try {
    // await ugPageActionsService({
    //   action: 'init',
    //   supplier: 'ug',
    // });

    const server: HTTPServer = app.listen(PORT, () => {
      logger.info(
        chalk.cyan.italic(
          `Server is running. Use port: ${(server.address() as AddressInfo).port}`
        )
      );
    });

    initializeSocket(server);

    // await ugPageActionsService({
    //   action: 'login',
    //   supplier: 'ug',
    //   username: process.env.UG_USERNAME || '',
    //   password: process.env.UG_PASSWORD || '',
    // });

    // await patriotPageActionsService({
    //   action: 'login',
    //   supplier: 'patriot',
    //   username: process.env.PATRIOT_USERNAME || '',
    //   password: process.env.PATRIOT_PASSWORD || '',
    // });

    // await turboCarsPageActionsService({
    //   action: 'login',
    //   supplier: 'turboCars',
    //   username: process.env.TURBOCARS_USERNAME || '',
    //   password: process.env.TURBOCARS_PASSWORD || '',
    // });

    // await turboCarsPageActionsService({
    //   action: 'login',
    //   supplier: 'turboCars',
    //   username: process.env.TURBOCARS_USERNAME_BN || '',
    //   password: process.env.TURBOCARS_PASSWORD_BN || '',
    // });

    // Добавляем обработчик для остановки сервера
    process.on('SIGINT', async () => {
      await closeAllResources();
      server.close(() => {
        logger.info(chalk.cyanBright.italic('Server closed'));
        process.exit();
      });
    });
  } catch (e) {
    logger.error((e as Error).message);
  }
};

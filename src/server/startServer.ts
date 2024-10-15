import chalk from 'chalk';
import { PORT } from 'config';
import type { Application } from 'express';
import { Server as HTTPServer } from 'http';
import { AddressInfo } from 'net';
import { ugPageActionsService } from 'services/pages/ugPageActionsService';
import { initializeSocket } from 'sockets';
import { logger } from '../config/logger';
// import { logger } from '../logger';

export const startServer = async (app: Application) => {
  try {
    await ugPageActionsService({
      action: 'init',
      supplier: 'ug',
    });

    const server: HTTPServer = app.listen(PORT, () => {
      logger.info(
        chalk.cyan.italic(
          `Server is running. Use port: ${(server.address() as AddressInfo).port}`
        )
      );
    });

    initializeSocket(server);
  } catch (e) {
    logger.error((e as Error).message);
  }
};

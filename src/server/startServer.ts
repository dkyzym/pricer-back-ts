import chalk from 'chalk';
import { PORT } from 'config/index.js';
import { logger } from 'config/logger/index.js';
import type { Application } from 'express';
import { Server as HTTPServer } from 'http';
import { AddressInfo } from 'net';
import { initializeSocket } from '../sockets/index.js';

export const startServer = async (app: Application) => {
  try {
    const server: HTTPServer = app.listen(PORT, () => {
      console.log('Current working directory:', process.cwd());

      logger.info(
        chalk.cyan.italic(
          `Server is running. Use port: ${(server.address() as AddressInfo).port} и пейте вкусный кофе`
        )
      );
    });

    initializeSocket(server);
  } catch (e) {
    logger.error((e as Error).message);
  }
};

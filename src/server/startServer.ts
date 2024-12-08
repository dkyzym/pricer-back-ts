import chalk from 'chalk';
import { PORT } from 'config';
import { logger } from 'config/logger';
import type { Application } from 'express';
import fs from 'fs/promises';
import { Server as HTTPServer } from 'http';
import { AddressInfo } from 'net';
import { searchTurbocarsCode } from '../services/turboCars/api/searchTurboCarsCode';
import { initializeSocket } from '../sockets';

export const startServer = async (app: Application) => {
  try {
    const server: HTTPServer = app.listen(PORT, () => {
      logger.info(
        chalk.cyan.italic(
          `Server is running. Use port: ${(server.address() as AddressInfo).port}`
        )
      );
    });

    const res = await searchTurbocarsCode('sm105');

    fs.writeFile('some.xml', res);

    initializeSocket(server);
  } catch (e) {
    logger.error((e as Error).message);
  }
};

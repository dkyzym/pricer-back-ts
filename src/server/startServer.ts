import chalk from 'chalk';
import type { Application } from 'express';
import { Server as HTTPServer } from 'http';
import { AddressInfo } from 'net';
import { PORT } from 'config';
import { ugPageActionsService } from 'services/pages/ugPageActionsService';
import { initializeSocket } from 'sockets';

export const startServer = async (app: Application) => {
  try {
    await ugPageActionsService({
      action: 'init',
      supplier: 'ug',
    });

    const server: HTTPServer = app.listen(PORT, () => {
      console.log(
        chalk.cyan.italic(
          `Server is running. Use port: ${(server.address() as AddressInfo).port}`
        )
      );
    });

    await initializeSocket(server);
  } catch (e) {
    console.log((e as Error).message);
  }
};

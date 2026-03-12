import dotenv from 'dotenv';
import app from './app.js';
import { logger } from './config/logger/index.js';
import { startServer } from './server/startServer.js';
import { initProxyCheck } from './services/apiClient/apiClient.js';
import { connectMongo } from './services/db/connectMongo.js';
import { startAllBrandsSyncWorker } from './workers/allBrandsSyncWorker.js';
import { startOrderSyncWorker } from './workers/orderSyncWorker.js';

dotenv.config();

process.on('unhandledRejection', (reason, promise) => {
  logger.error('[CRITICAL] Unhandled Rejection at promise:', { promise, reason });
});

process.on('uncaughtException', (error) => {
  logger.error('[CRITICAL] Uncaught Exception:', error);
  
  setTimeout(() => {
    process.exit(1);
  }, 1000).unref();
});

await connectMongo();
await initProxyCheck();
await startServer(app);
startAllBrandsSyncWorker();
startOrderSyncWorker();

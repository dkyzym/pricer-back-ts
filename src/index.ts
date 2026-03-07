import { error } from '@middleware/errorsMiddleware.js';
import authRoutes from '@routes/authRoutes.js';
import dataRoutes from '@routes/dataRoutes.js';
import logsRoutes from '@routes/logsRoutes.js';
import ordersRoutes from '@routes/ordersRoutes.js';
import { RouteNotFoundError } from '@utils/errors.js';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { CLIENT_BUILD_PATH, corsOptions } from './config/index.js';
import { morganMiddleware } from './config/logger/morganMiddleware.js';
import { helloController } from './controllers/helloController.js';
import { startServer } from './server/startServer.js';
import { initProxyCheck } from './services/apiClient/apiClient.js';
import { connectMongo } from './services/db/connectMongo.js';
import { startAllBrandsSyncWorker } from './workers/allBrandsSyncWorker.js';
import { startOrderSyncWorker } from './workers/orderSyncWorker.js';

dotenv.config();

const distPath = path.resolve(process.cwd(), CLIENT_BUILD_PATH);

const app = express();

app.use(morganMiddleware);
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(cookieParser());
app.use(cors(corsOptions));
app.use(express.urlencoded({ extended: true }));

app.use(express.static(distPath));

app.use('/api', authRoutes);
app.use('/api', dataRoutes);
app.use('/api', logsRoutes);
app.use('/api', ordersRoutes);
app.use('/test', helloController);

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/socket.io')) {
    return next();
  }
  res.sendFile(path.join(distPath, 'index.html'));
});

app.use(() => {
  throw new RouteNotFoundError();
});

app.use(error);

await connectMongo();
await initProxyCheck();
await startServer(app);
startAllBrandsSyncWorker();
startOrderSyncWorker();

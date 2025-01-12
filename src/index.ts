import { error } from '@middleware/errorsMiddleware.js';

import dataRoutes from '@routes/dataRoutes.js';
import { RouteNotFoundError } from '@utils/errors.js';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import morgan from 'morgan';
import { corsOptions } from './config/index.js';
import { startServer } from './server/startServer.js';

dotenv.config();

const app = express();

app.use(morgan('short'));
app.use(cookieParser());
app.use(cors(corsOptions));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use('/api', dataRoutes);

app.use(() => {
  throw new RouteNotFoundError();
});

app.use(error);

await startServer(app);

import { error } from '@middleware/errorsMiddleware';
import authRoutes from '@routes/authRoutes';
import dataRoutes from '@routes/dataRoutes';
import { RouteNotFoundError } from '@utils/errors';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import morgan from 'morgan';
import { corsOptions } from './config';
import { startServer } from './server/startServer';

dotenv.config();

const app = express();

app.use(morgan('short'));
app.use(cookieParser());
app.use(cors(corsOptions));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use('/', authRoutes);
app.use('/', dataRoutes);

app.use(() => {
  throw new RouteNotFoundError();
});

app.use(error);

await startServer(app);

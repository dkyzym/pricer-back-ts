import { error } from '@middleware/errorsMiddleware';
import authRoutes from '@routes/authRoutes';
import { RouteNotFoundError } from '@utils/errors';
import chalk from 'chalk';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { Server } from 'http';
import morgan from 'morgan';
import { AddressInfo } from 'net';

dotenv.config();

const app = express();

const { PORT = 3000, CLIENT_URL } = process.env;

const corsOptions = {
  origin: `${CLIENT_URL}`,
  credentials: true,
};

app.use(morgan('short'));
app.use(cookieParser());
app.use(cors(corsOptions));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use('/', authRoutes);
// app.use('/', dataRoutes);

app.use(() => {
  throw new RouteNotFoundError();
});

app.use(error);

const start = async () => {
  try {
    const server: Server = app.listen(PORT, () => {
      console.log(
        chalk.cyan.italic(
          `Server is running. Use port: ${(server.address() as AddressInfo).port}`
        )
      );
    });
  } catch (e) {
    console.log((e as Error).message);
  }
};

start();

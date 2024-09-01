import { error } from '@middleware/errorsMiddleware';
import authRoutes from '@routes/authRoutes';
import dataRoutes from '@routes/dataRoutes';
import { RouteNotFoundError } from '@utils/errors';
import chalk from 'chalk';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { Server as HTTPServer } from 'http';
import morgan from 'morgan';
import { AddressInfo } from 'net';
import { Server as SocketIOServer } from 'socket.io';
import { ugPageActionsService } from './services/pages/ugPageActionsService';

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
app.use('/', dataRoutes);

app.use(() => {
  throw new RouteNotFoundError();
});

app.use(error);

const start = async () => {
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

    const io = new SocketIOServer(server, {
      cors: {
        origin: CLIENT_URL,
        methods: ['GET', 'POST'],
      },
    });

    io.on('connection', (socket) => {
      console.log(`New client connected: ${socket.id}`);

      socket.on('autocomplete', async (query: string) => {
        try {
          const results = await ugPageActionsService({
            action: 'autocomplete',
            query,
            supplier: 'ug',
          });
          socket.emit('autocompleteResults', { query, results });
        } catch (error) {
          console.error('Autocomplete error:', error);
          socket.emit('autocompleteError', { query, message: error });
        }
      });

      socket.on('getItemResults', async (item) => {
        try {
          const ugSearchResult = await ugPageActionsService({
            action: 'pick',
            item,
            supplier: 'ug',
          });
          console.log(ugSearchResult);
        } catch (error) {
          console.log(error);
        }
      });

      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
      });
    });
  } catch (e) {
    console.log((e as Error).message);
  }
};

start();

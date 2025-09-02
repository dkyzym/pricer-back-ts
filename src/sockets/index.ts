import chalk from 'chalk';
import { CLIENT_URL } from 'config/index.js';
import { attachSocketTransport, logger } from 'config/logger/index.js';
import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { SOCKET_EVENTS } from '../constants/socketEvents.js';
import { verifyToken } from '../controllers/auth.js';
import { createBrandClarificationHandler } from './handlers/brandClarificationHandler.js';
import { createItemResultsHandler } from './handlers/itemResultsHandler.js';

let transportAttached = false;

export const initializeSocket = (server: HTTPServer) => {
  const io = new SocketIOServer(server, {
    cors: { origin: CLIENT_URL, methods: ['GET', 'POST'] },
  });

  if (!transportAttached) {
    attachSocketTransport(io);
    transportAttached = true;
  }

  // Middleware для аутентификации
  io.use((socket, next) => {
    try {
      const token = socket.handshake.query.token as string | undefined;
      if (!token) return next(new Error('No token provided'));
      const payload = verifyToken(token);
      socket.data.user = { username: payload.username, role: payload.role };
      next();
    } catch (err) {
      return next(err as any);
    }
  });

  io.on('connection', async (socket) => {
    const userLogger = logger.child({
      user: socket.data.user?.username,
      socketId: socket.id,
    });
    userLogger.info(chalk.cyan(`New client connected`));

    if (socket.data.user.role === 'admin') {
      socket.join('admin');
      userLogger.info(`Joined room "admin"`);
    }

    // Отправляем событие об успешном подключении клиенту
    socket.emit(SOCKET_EVENTS.CONNECT, { message: 'Connected to server' });
    // --- КОНЕЦ ВОССТАНОВЛЕННОЙ ЛОГИКИ ---

    // --- Регистрация обработчиков событий ---
    socket.on(
      SOCKET_EVENTS.BRAND_CLARIFICATION,
      createBrandClarificationHandler(socket, userLogger)
    );

    socket.on(
      SOCKET_EVENTS.GET_ITEM_RESULTS,
      createItemResultsHandler(socket, userLogger)
    );

    socket.on('disconnect', () => {
      userLogger.info(chalk.bgCyan(`Client disconnected:`));
    });
  });
};

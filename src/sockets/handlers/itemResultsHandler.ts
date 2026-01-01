import { Socket } from 'socket.io';
import { Logger } from 'winston';
import { getItemResultsParams } from '../../types/search.types.js';
import { universalSupplierHandler } from './universalSupplierHandler.js';

// 1. Объявляем интерфейс для наших кастомных данных сокета
interface SocketData {
  user: {
    username: string;
    role: string;
  };
  // Добавляем поле для хранения последнего поиска
  lastSearch?: {
    key: string;
    timestamp: number;
  };
}

export const createItemResultsHandler = (
  // 2. Указываем дженерики для Socket:
  // Socket<ClientEvents, ServerEvents, InterServerEvents, SocketData>
  socket: Socket,
  userLogger: Logger
) => {
  return async (data: getItemResultsParams) => {
    const { item } = data;

    // --- ЛОГИКА "ЧИСТОГО" ЛОГИРОВАНИЯ ---
    const currentSearchKey = `${item.brand}:${item.article}`;
    const now = Date.now();

    // Приводим socket.data к нашему интерфейсу
    const sData = socket.data as SocketData;

    const lastSearch = sData.lastSearch;

    // Считаем дублем, если артикул тот же и прошло меньше 2 секунд
    const isDuplicate =
      lastSearch &&
      lastSearch.key === currentSearchKey &&
      now - lastSearch.timestamp < 2000;

    if (!isDuplicate) {
      // Пишем лог только 1 раз на всю пачку запросов
      // Добавляем префикс [Global Search], чтобы фронтенду было легко искать
      userLogger.info(
        `[Global Search] Searching for article: ${item.article}, brand: ${item.brand}`
      );

      // Обновляем метку
      sData.lastSearch = {
        key: currentSearchKey,
        timestamp: now,
      };
    }
    // ------------------------------------

    await universalSupplierHandler(socket, data, userLogger);
  };
};

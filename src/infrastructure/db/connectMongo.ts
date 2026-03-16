import { logger } from '../../config/logger/index.js';
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || '';

/**
 * Подключается к MongoDB с логированием событий соединения.
 * Слушатели событий (connected, error, disconnected) позволяют отлавливать обрывы связи.
 */
export async function connectMongo(): Promise<void> {
  if (!MONGODB_URI) {
    logger.error('[MongoDB] MONGODB_URI или MONGO_URI не заданы в окружении');
    throw new Error('MONGODB_URI is required');
  }

  mongoose.connection.on('connected', () =>
    logger.info('[MongoDB] Connected successfully')
  );
  mongoose.connection.on('error', (err) =>
    logger.error('[MongoDB] Connection error', { error: err })
  );
  mongoose.connection.on('disconnected', () =>
    logger.warn('[MongoDB] Disconnected')
  );

  try {
    await mongoose.connect(MONGODB_URI);
  } catch (err) {
    logger.error('[MongoDB] Fatal error on startup', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    throw err;
  }
}

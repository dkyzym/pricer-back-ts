import crypto from 'crypto';
import { Request } from 'express';
import { logger } from '../config/logger/index.js';

// Определяем интерфейс один раз, чтобы его можно было использовать везде.
interface RequestWithRawBody extends Request {
  rawBody: Buffer;
}

/**
 * Проверяет подпись вебхука GitHub для подтверждения подлинности запроса.
 * Эта функция "чистая" - она не зависит от process.env и получает все необходимое через аргументы.
 * @param req Объект запроса Express с полем rawBody.
 * @param secret Секретный ключ для проверки подписи.
 * @returns True, если подпись верна, иначе false.
 */
export function verifyGithubSignature(req: RequestWithRawBody, secret: string): boolean {
  const signature = req.headers['x-hub-signature-256'] as string;
  if (!signature) {
    logger.warn('Заголовок с подписью "x-hub-signature-256" не найден.');
    return false;
  }

  const hmac = crypto.createHmac('sha256', secret);
  const digest = `sha256=${hmac.update(req.rawBody).digest('hex')}`;

  try {
    // Безопасное сравнение, защищенное от атак по времени.
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch (error) {
    logger.warn('Ошибка при сравнении подписей. Возможно, форматы подписей различаются.', error);
    return false;
  }
}

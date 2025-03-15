import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { logger } from '../config/logger/index.js';
import { verifyToken } from './auth.js';

export const logsController = async (req: Request, res: Response) => {
  // 1) Авторизация. Допустим, токен лежит в заголовке Authorization: Bearer ...
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    logger.warn('No auth header');

    return res.status(401).json({ message: 'No auth header' });
  }
  const [_, token] = authHeader.split(' ');
  if (!token) {
    logger.warn('No token');
    return res.status(401).json({ message: 'No token' });
  }
  const payload = verifyToken(token);
  if (payload.role !== 'admin') {
    logger.warn('Forbidden');
    return res.status(403).json({ message: 'Forbidden' });
  }

  // 2) Получаем дату из query
  const dateParam = req.query.date as string | undefined;
  if (!dateParam) {
    logger.warn('Missing date param');
    return res.status(400).json({ message: 'Missing date param' });
  }

  // 3) Формируем путь к файлу
  const fileName = `combined-${dateParam}.log`; // например, "combined-2025-03-14.log"
  const filePath = path.join(process.cwd(), 'logs', 'combined', fileName);

  // Проверяем, существует ли файл
  if (!fs.existsSync(filePath)) {
    logger.error('Log file not found');
    return res.status(404).json({ message: 'Log file not found' });
  }

  // 4) Читаем файл построчно, парсим JSON
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: fileStream });

  const logs: any[] = [];

  for await (const line of rl) {
    // Каждая строка – JSON
    try {
      const logObj = JSON.parse(line);
      logs.push(logObj);
    } catch (err) {
      logger.warn(`Failed to parse log line: ${line}`);
    }
  }

  // 5) Отправляем массив логов
  return res.json({ logs });
};

import { exec } from 'child_process';
import dotenv from 'dotenv';
import express, { Request, Response } from 'express';

import { logger } from './src/config/logger/index.js';
import { verifyGithubSignature } from './src/utils/verifySignature.js';

dotenv.config();

const GITHUB_SECRET = process.env.GITHUB_SECRET;
const PORT = process.env.WEBHOOK_PORT || 3002;

const app = express();

if (!GITHUB_SECRET) {
  logger.error(
    'КРИТИЧЕСКАЯ ОШИБКА: GITHUB_SECRET не определен в переменных окружения.'
  );
  process.exit(1);
}

logger.info(`Запуск Webhook. Порт: ${PORT}`);

interface RequestWithRawBody extends Request {
  rawBody: Buffer;
}

app.use(
  express.json({
    verify: (req: RequestWithRawBody, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

function createWebhookHandler(serviceName: string, deployCommand: string) {
  return (req: Request, res: Response) => {
    if (!verifyGithubSignature(req as RequestWithRawBody, GITHUB_SECRET!)) {
      logger.warn(`[${serviceName}] Неверная подпись вебхука.`);
      return res.status(401).send('Не авторизован');
    }

    if (req.headers['x-github-event'] !== 'push') {
      logger.info(`[${serviceName}] Это не push-событие, игнорируем.`);
      return res.status(200).send('Это не push-событие');
    }

    // Мгновенный ответ провайдеру, чтобы избежать таймаута
    res.status(202).send('Сборка и развертывание запущены в фоновом режиме');
    logger.info(`[${serviceName}] Получено push-событие. Начинаю фоновое развертывание...`);

    // Запуск сборки
    exec(deployCommand, { maxBuffer: 1024 * 1024 * 10 }, (err, stdout, stderr) => {
      if (stdout) logger.info(`[${serviceName}] Вывод консоли (STDOUT):\n${stdout}`);
      
      // Внимание: npm часто пишет обычные логи в stderr. 
      // Выводим как инфо, чтобы не засорять логи ошибок.
      if (stderr) logger.info(`[${serviceName}] Поток ошибок/предупреждений (STDERR):\n${stderr}`);

      if (err) {
        logger.error(`[${serviceName}] КРИТИЧЕСКАЯ ОШИБКА во время развертывания:`, err.message);
        return; 
      }

      logger.info(`[${serviceName}] Развертывание успешно завершено. Служба API должна быть перезапущена.`);
    });
  };
}

// Единая конфигурация для Fullstack-сборки
const deployConfig = {
  name: 'Fullstack Deploy',
  command:
    'cd /d D:/projects/pricer-back-ts ' +
    '&& git pull origin main ' +
    '&& npm install ' +
    '&& npm run build ' +
    '&& cd /d D:/projects/pricer-front ' +
    '&& git pull origin main ' +
    '&& npm install ' +
    '&& npm run build ' +
    '&& "C:/nssm/nssm.exe" restart pricer-back',
};

app.post(
  '/webhook',
  createWebhookHandler(deployConfig.name, deployConfig.command)
);

// ДОБАВЛЕН ОТСУТСТВУЮЩИЙ ЗАПУСК СЕРВЕРА
app.listen(PORT, () => {
  logger.info(`Сервис вебхуков успешно запущен и слушает порт ${PORT}...`);
});
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

function createWebhookHandler(
  serviceName: string,
  workingDir: string,
  deployCommand: string
) {
  return (req: Request, res: Response) => {
    if (!verifyGithubSignature(req as RequestWithRawBody, GITHUB_SECRET!)) {
      logger.warn(`[${serviceName}] Неверная подпись вебхука.`);
      return res.status(401).send('Не авторизован');
    }

    if (req.headers['x-github-event'] !== 'push') {
      logger.info(`[${serviceName}] Это не push-событие, игнорируем.`);
      return res.status(200).send('Это не push-событие');
    }

    logger.info(
      `[${serviceName}] Получено корректное push-событие. Начинаю развертывание...`
    );

    exec(deployCommand, { cwd: workingDir }, (err, stdout, stderr) => {
      if (stdout) logger.info(`[${serviceName}] STDOUT:\n${stdout}`);
      if (stderr) logger.info(`[${serviceName}] STDERR:\n${stderr}`);

      if (err) {
        logger.error(`[${serviceName}] Ошибка во время развертывания:`, err);
        return res.status(500).send('Произошла ошибка при развертывании.');
      }

      logger.info(`[${serviceName}] Развертывание успешно завершено.`);
      return res.status(200).send('OK');
    });
  };
}

app.get('/', (_req: Request, res: Response) => {
  res.status(200).send('Сервис вебхуков запущен.');
});

// Конфигурация ТОЛЬКО для бекенда, так как он собирает и раздает фронт
const backendConfig = {
  name: 'Backend',
  path: 'D:/projects/pricer-back-ts',
  // Добавил npm run build для фронта внутрь команды бекенда,
  // если у тебя скрипт бека не билдит фронт сам.
  // Если у тебя бек просто раздает папку dist, которую ты билдишь руками -
  // то оставь как было. Но лучше автоматизировать.
  command:
    'git pull origin main && npm install && npm run build && "C:/nssm/nssm.exe" restart pricer-back',
};

// Маршрут для фронта убрал, так как отдельного сервиса нет
app.post(
  '/webhook',
  createWebhookHandler(
    backendConfig.name,
    backendConfig.path,
    backendConfig.command
  )
);

app.listen(PORT, () => {
  logger.info(`Сервис вебхуков слушает порт ${PORT}...`);
});

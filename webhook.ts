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
  logger.error(
    'Пожалуйста, создайте файл .env с GITHUB_SECRET="your_strong_secret" или установите переменную в вашем окружении.'
  );
  process.exit(1);
}

logger.info(`Запуск Webhook. Порт: ${PORT}`);
logger.info(
  `Статус  GITHUB_SECRET: ${GITHUB_SECRET ? 'ЗАГРУЖЕН (OK)' : 'ПУСТО (ERROR)'}`
);

// --- Middleware ---
// Расширяем интерфейс Request, чтобы TypeScript знал о свойстве rawBody
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
// --- Вспомогательные функции ---

/**
 * Создает переиспользуемый обработчик вебхуков, чтобы избежать дублирования кода.
 * @param serviceName - Имя сервиса для логирования (например, "Backend").
 * @param workingDir - Абсолютный путь к рабочей директории проекта.
 * @param deployCommand - Команда, которую нужно выполнить для деплоя.
 * @returns Обработчик запроса для Express.
 */
function createWebhookHandler(
  serviceName: string,
  workingDir: string,
  deployCommand: string
) {
  return (req: Request, res: Response) => {
    // ✅ 2. Используем импортированную функцию. Код чистый и понятный.
    // Мы уверены, что GITHUB_SECRET существует, благодаря проверке на старте.
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

// --- Определение маршрутов (Routes) ---
app.get('/', (_req: Request, res: Response) => {
  res.status(200).send('Сервис вебхуков запущен.');
});

const backendConfig = {
  name: 'Backend',
  path: 'D:/projects/pricer-back-ts',
  command:
    'git pull origin main && npm install && npm run build && "C:/nssm/nssm.exe" restart pricer-back',
};

const frontendConfig = {
  name: 'Frontend',
  path: 'D:/projects/pricer-front',
  command:
    'git pull origin main && npm install && npm run build && "C:/nssm/nssm.exe" restart pricer-front-service-name',
};

app.post(
  '/webhook',
  createWebhookHandler(
    backendConfig.name,
    backendConfig.path,
    backendConfig.command
  )
);
app.post(
  '/webhook-frontend',
  createWebhookHandler(
    frontendConfig.name,
    frontendConfig.path,
    frontendConfig.command
  )
);

// --- Запуск сервера ---
app.listen(PORT, () => {
  logger.info(`Сервис вебхуков слушает порт ${PORT}...`);
});

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

// function createWebhookHandler(
//   serviceName: string,
//   workingDir: string,
//   deployCommand: string
// ) {
//   return (req: Request, res: Response) => {
//     if (!verifyGithubSignature(req as RequestWithRawBody, GITHUB_SECRET!)) {
//       logger.warn(`[${serviceName}] Неверная подпись вебхука.`);
//       return res.status(401).send('Не авторизован');
//     }

//     if (req.headers['x-github-event'] !== 'push') {
//       logger.info(`[${serviceName}] Это не push-событие, игнорируем.`);
//       return res.status(200).send('Это не push-событие');
//     }

//     logger.info(
//       `[${serviceName}] Получено корректное push-событие. Начинаю развертывание...`
//     );

//     exec(deployCommand, { cwd: workingDir }, (err, stdout, stderr) => {
//       if (stdout) logger.info(`[${serviceName}] STDOUT:\n${stdout}`);
//       if (stderr) logger.info(`[${serviceName}] STDERR:\n${stderr}`);

//       if (err) {
//         logger.error(`[${serviceName}] Ошибка во время развертывания:`, err);
//         return res.status(500).send('Произошла ошибка при развертывании.');
//       }

//       logger.info(`[${serviceName}] Развертывание успешно завершено.`);
//       return res.status(200).send('OK');
//     });
//   };
// }

// app.get('/', (_req: Request, res: Response) => {
//   res.status(200).send('Сервис вебхуков запущен.');
// });

// // Конфигурация ТОЛЬКО для бекенда, так как он собирает и раздает фронт
// const backendConfig = {
//   name: 'Backend',
//   path: 'D:/projects/pricer-back-ts',
//   // Добавил npm run build для фронта внутрь команды бекенда,
//   // если у тебя скрипт бека не билдит фронт сам.
//   // Если у тебя бек просто раздает папку dist, которую ты билдишь руками -
//   // то оставь как было. Но лучше автоматизировать.
//   command:
//     'git pull origin main && npm install && npm run build && "C:/nssm/nssm.exe" restart pricer-back',
// };

// // Маршрут для фронта убрал, так как отдельного сервиса нет
// app.post(
//   '/webhook',
//   createWebhookHandler(
//     backendConfig.name,
//     backendConfig.path,
//     backendConfig.command
//   )
// );

// app.listen(PORT, () => {
//   logger.info(`Сервис вебхуков слушает порт ${PORT}...`);
// });
// Обновленная функция без жесткого cwd и с асинхронным ответом
function createWebhookHandler(
  serviceName: string,
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

    // 1. МГНОВЕННЫЙ ОТВЕТ провайдеру, чтобы избежать таймаута
    res.status(202).send('Сборка и развертывание запущены в фоновом режиме');

    logger.info(`[${serviceName}] Получено корректное push-событие. Начинаю фоновое развертывание...`);

    // 2. ЗАПУСК СБОРКИ (с увеличенным буфером до 10MB для логов npm)
    exec(deployCommand, { maxBuffer: 1024 * 1024 * 10 }, (err, stdout, stderr) => {
      if (stdout) logger.info(`[${serviceName}] STDOUT:\n${stdout}`);
      if (stderr) logger.info(`[${serviceName}] STDERR:\n${stderr}`);

      if (err) {
        logger.error(`[${serviceName}] КРИТИЧЕСКАЯ ОШИБКА во время развертывания:`, err);
        return; // Ответ уже отправлен, просто логируем
      }

      logger.info(`[${serviceName}] Развертывание бэкенда и фронтенда успешно завершено.`);
    });
  };
}

// Единая конфигурация для Fullstack-сборки
// Используем cd /d для гарантированного перехода по дискам в Windows
const deployConfig = {
  name: 'Fullstack Deploy',
  command: 
    // 1. Сборка Бэкенда
    'cd /d D:/projects/pricer-back-ts ' +
    '&& git pull origin main ' +
    '&& npm install ' +
    '&& npm run build ' +
    // 2. Сборка Фронтенда
    '&& cd /d D:/projects/pricer-front ' +
    '&& git pull origin main ' +
    '&& npm install ' +
    '&& npm run build ' +
    // 3. Перезапуск службы API (выполняется только если предыдущие шаги успешны)
    '&& "C:/nssm/nssm.exe" restart pricer-back'
};

app.post(
  '/webhook',
  createWebhookHandler(
    deployConfig.name,
    deployConfig.command
  )
);
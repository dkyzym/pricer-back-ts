import { exec } from 'child_process';
import crypto from 'crypto';
import dotenv from 'dotenv';
import express, { Request, Response } from 'express';

dotenv.config();

// --- Конфигурация ---
const GITHUB_SECRET = process.env.GITHUB_SECRET;
const PORT = process.env.PORT || 3002;

// --- Настройка приложения ---
const app = express();

// --- Предварительные проверки ---
// Убеждаемся, что приложение не запустится без секрета.
if (!GITHUB_SECRET) {
  console.error('КРИТИЧЕСКАЯ ОШИБКА: GITHUB_SECRET не определен в переменных окружения.');
  console.error('Пожалуйста, создайте файл .env с GITHUB_SECRET="your_strong_secret" или установите переменную в вашем окружении.');
  process.exit(1); // Завершаем процесс с кодом ошибки
}

// --- Middleware (Промежуточное ПО) ---
// Расширяем интерфейс Request, чтобы включить rawBody
interface RequestWithRawBody extends Request {
  rawBody: Buffer;
}

// Middleware для получения "сырого" тела запроса, необходимого для проверки подписи.
app.use(
  express.json({
    verify: (req: RequestWithRawBody, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

// --- Вспомогательные функции ---
/**
 * Проверяет подпись вебхука GitHub для подтверждения подлинности запроса.
 * @param req Объект запроса Express, расширенный свойством rawBody.
 * @returns True, если подпись верна, иначе false.
 */
function verifySignature(req: RequestWithRawBody): boolean {
  // Имя заголовка - 'x-hub-signature-256'
  const signature = req.headers['x-hub-signature-256'] as string;
  if (!signature) {
    console.warn('Заголовок с подписью не найден.');
    return false;
  }

  // Мы уверены, что GITHUB_SECRET определен, благодаря проверке на старте
  const hmac = crypto.createHmac('sha256', GITHUB_SECRET!); 
  const digest = `sha256=${hmac.update(req.rawBody).digest('hex')}`;

  try {
    // Используем crypto.timingSafeEqual для защиты от атак по времени
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch (error) {
    console.warn('Ошибка при сравнении подписей. Возможно, форматы подписей различаются.', error);
    return false;
  }
}

/**
 * Создает переиспользуемый обработчик вебхуков, чтобы избежать дублирования кода.
 * @param serviceName - Имя сервиса для логирования (например, "Backend").
 * @param workingDir - Абсолютный путь к рабочей директории проекта.
 * @param deployCommand - Команда, которую нужно выполнить для деплоя.
 * @returns Обработчик запроса для Express.
 */
function createWebhookHandler(serviceName: string, workingDir: string, deployCommand: string) {
  return (req: Request, res: Response) => {
    // 1) Проверяем подпись
    if (!verifySignature(req as RequestWithRawBody)) {
      console.log(`[${serviceName}] Неверная подпись вебхука.`);
      return res.status(401).send('Не авторизован');
    }

    // 2) Проверяем, что это событие 'push'
    if (req.headers['x-github-event'] !== 'push') {
      console.log(`[${serviceName}] Это не push-событие, игнорируем.`);
      return res.status(200).send('Это не push-событие');
    }
    
    // 3) Проверка ветки (опционально, но рекомендуется)
    // Например, развертывать изменения только из ветки 'main' или 'prod'
    // const ref = req.body.ref;
    // if (ref !== 'refs/heads/main') {
    //   console.log(`[${serviceName}] Push был в ветку ${ref}, а не в main. Игнорируем.`);
    //   return res.status(200).send(`Push в ветку ${ref} проигнорирован.`);
    // }

    console.log(`[${serviceName}] Получено корректное push-событие. Начинаю развертывание...`);

    // 4) Выполняем скрипт развертывания
    exec(deployCommand, { cwd: workingDir }, (err, stdout, stderr) => {
      // Логируем stdout и stderr для отладки
      if (stdout) console.log(`[${serviceName}] STDOUT:\n${stdout}`);
      if (stderr) console.log(`[${serviceName}] STDERR:\n${stderr}`);

      if (err) {
        console.error(`[${serviceName}] Ошибка во время развертывания:`, err);
        // Не отправляем детальную информацию об ошибке клиенту
        return res.status(500).send('Произошла ошибка при развертывании.');
      }

      console.log(`[${serviceName}] Развертывание успешно завершено.`);
      return res.status(200).send('OK');
    });
  };
}

// --- Определение маршрутов (Routes) ---
app.get('/', (_req: Request, res: Response) => {
  res.status(200).send('Сервис вебхуков запущен.');
});

// Определяем конфигурации для развертывания
const backendConfig = {
  name: 'Backend',
  path: 'D:/projects/pricer-back-ts',
  command: 'git pull origin main && npm install && npm run build && "C:/nssm/nssm.exe" restart pricer-back'
};

const frontendConfig = {
  name: 'Frontend',
  path: 'D:/projects/pricer-front',
  // Предполагаем, что команда перезапуска для фронтенда такая же
  command: 'git pull origin main && npm install && npm run build && "C:/nssm/nssm.exe" restart pricer-front-service-name' // ИЗМЕНИТЕ ИМЯ СЕРВИСА
};

// Регистрируем маршруты для вебхуков, используя общий обработчик
app.post('/webhook', createWebhookHandler(backendConfig.name, backendConfig.path, backendConfig.command));
app.post('/webhook-frontend', createWebhookHandler(frontendConfig.name, frontendConfig.path, frontendConfig.command));


// --- Запуск сервера ---
app.listen(PORT, () => {
  console.log(`Сервис вебхуков слушает порт ${PORT}...`);
});


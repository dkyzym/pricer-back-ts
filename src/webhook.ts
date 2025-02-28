import { exec } from 'child_process';
import crypto from 'crypto';
import express, { Request, Response } from 'express';

// Секрет для проверки подписи GitHub.
// Можно хранить в .env и подтягивать через process.env:
const GITHUB_SECRET = process.env.GITHUB_SECRET || 'catBoris';

// Создаём приложение Express
const app = express();

// Нам нужно «raw body» для проверки подписи
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

// Функция проверки подписи GitHub
function verifySignature(req: any) {
  const signature = req.headers['x-hub-signature-256'] as string;
  if (!signature) return false;

  const hmac = crypto.createHmac('sha256', GITHUB_SECRET);
  const digest = 'sha256=' + hmac.update(req.rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}

// Обработка корневого маршрута
app.get('/', (req: Request, res: Response) => {
  res.status(200).send('Привет! Сервер работает.');
});

// Роут /webhook
app.post('/webhook', (req: Request, res: Response) => {
  // 1) Проверяем подпись
  if (!verifySignature(req)) {
    console.log('Неверная подпись Webhook');
    return res.status(401).send('Unauthorized');
  }

  // 2) Проверяем, что это push-событие
  if (req.headers['x-github-event'] !== 'push') {
    console.log('Не push-событие, игнорируем');
    return res.status(200).send('Not a push event');
  }

  console.log('Получен push Webhook, запускаю обновление...');

  // 3) Выполняем git pull, сборку, перезапуск главного сервиса
  exec(
    'git pull origin main && npm install && npm run build && "C:/nssm/nssm.exe" restart pricer-back',
    {
      cwd: 'D:/projects/pricer-back-ts', // Папка, где лежат .git, package.json и т.д.
    },
    (err, stdout, stderr) => {
      console.log('STDOUT:', stdout);
      console.log('STDERR:', stderr);
      if (err) {
        console.error('Ошибка при деплое:', err);
        return res.status(500).send('Ошибка деплоя');
      }
      console.log('Деплой успешно завершён');
      return res.status(200).send('OK');
    }
  );
});

// Запускаем Webhook-сервис на порту 3002
const PORT = 3002;
app.listen(PORT, () => {
  console.log(`Webhook service listening on port ${PORT}...`);
});

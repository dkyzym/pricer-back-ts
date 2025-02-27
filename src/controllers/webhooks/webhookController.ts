import { exec } from 'child_process';
import { Request, Response } from 'express';
import { verifySignature } from '../../utils/verifySignature.js';

export const webhookController = (req: Request, res: Response) => {
  // 1) Проверяем подпись
  if (!verifySignature(req)) {
    console.log('Неверная подпись Webhook');
    return res.status(401).send('Unauthorized');
  }

  // 2) Опционально проверим, что это push event
  if (req.headers['x-github-event'] !== 'push') {
    console.log('Не push-событие, игнорируем');
    return res.status(200).send('Not a push event');
  }

  // 3) Запускаем обновление
  console.log('Получен push Webhook, запускаю обновление...');

  // Команды можно выполнять одной строкой или по отдельности
  // В примере ниже запускаем последовательность команд в child_process
  exec(
    'git pull origin main && npm install && npm run build && pm2 restart all',
    { cwd: 'D:/projects/pricer-back-ts' },
    (err, stdout, stderr) => {
      if (err) {
        console.error('Ошибка при выполнении команд:', err);
        return res.status(500).send('Ошибка деплоя');
      }
      console.log('Вывод команд:', stdout);
      console.error('Ошибки команд:', stderr);
      console.log('Деплой успешно завершён');
      return res.status(200).send('Updated');
    }
  );
};

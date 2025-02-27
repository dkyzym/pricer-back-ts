import crypto from 'crypto';

export function verifySignature(req: any) {
  const GITHUB_SECRET = process.env.GITHUB_SECRET || 'catBoris';
  // GitHub шлёт подпись в заголовке: X-Hub-Signature-256
  const signature = req.headers['x-hub-signature-256'] as string;
  if (!signature) return false;

  // Вычисляем SHA-256 хеш тела запроса (req.rawBody) с вашим секретом
  const hmac = crypto.createHmac('sha256', GITHUB_SECRET);
  const digest = 'sha256=' + hmac.update(req.rawBody).digest('hex');

  // Сравниваем вычисленную подпись и то, что прислал GitHub
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}

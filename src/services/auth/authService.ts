import { Request, Response } from 'express';
import { logger } from '../../config/logger/index.js';
import { authenticateUser, signToken } from '../../controllers/auth.js';

interface AuthRequestBody {
  username?: string;
  password?: string;
}

export const authService = (req: Request, res: Response) => {
  const { username, password } = req.body as AuthRequestBody;

  if (!username || !password) {
    logger.warn(
      `auth: Username and password required Username: ${username || undefined}, Password: ${password || undefined}`
    );
    return res.status(400).json({ message: 'Username and password required' });
  }
  const user = authenticateUser(username, password);
  if (!user) {
    logger.warn('auth: Invalid credentials');
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  const token = signToken(user);
  // Простой ответ с токеном
  logger.info(`auth: logged in: ${JSON.stringify(user)} `);
  return res.json({ token, user });
};

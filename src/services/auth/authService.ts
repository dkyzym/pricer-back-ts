import { Request, Response } from 'express';
import { authenticateUser, signToken } from '../../controllers/auth.js';

interface AuthRequestBody {
  username?: string;
  password?: string;
}

export const authService = (req: Request, res: Response) => {
  const { username, password } = req.body as AuthRequestBody;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password required' });
  }
  const user = authenticateUser(username, password);
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  const token = signToken(user);
  // Простой ответ с токеном
  return res.json({ token, user });
};

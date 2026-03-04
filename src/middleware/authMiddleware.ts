import { NextFunction, Request, Response } from 'express';
import { verifyToken } from '../controllers/auth.js';

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Token required' });
    return;
  }

  try {
    const token = header.slice(7);
    const payload = verifyToken(token);
    (req as any).user = payload;
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

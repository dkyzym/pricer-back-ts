import { Request, Response } from 'express';
import { CartItem } from '../../models/CartItem.js';

/**
 * Получение позиций виртуальной корзины.
 * admin — видит все позиции со статусом draft/approved.
 * user  — видит только свои позиции (фильтр по username из JWT).
 */
export const getCartController = async (req: Request, res: Response) => {
  const { username, role } = req.user!;

  const filter =
    role === 'admin'
      ? { status: { $in: ['draft', 'approved'] } }
      : { username, status: { $in: ['draft', 'approved'] } };

  const items = await CartItem.find(filter)
    .sort({ createdAt: -1 })
    .lean();

  return res.status(200).json({ success: true, data: items });
};

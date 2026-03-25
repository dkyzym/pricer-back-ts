import { Request, Response } from 'express';
import { CartItem } from '../../models/CartItem.js';

/**
 * Получение позиций виртуальной корзины (все статусы).
 * admin — все позиции; user — только свои (фильтр по username из JWT).
 * Разделение «текущая корзина» / «история» — на клиенте по вкладке.
 */
export const getCartController = async (req: Request, res: Response) => {
  const { username, role } = req.user!;

  const filter = role === 'admin' ? {} : { username };

  const items = await CartItem.find(filter)
    .sort({ createdAt: -1 })
    .lean();

  return res.status(200).json({ success: true, data: items });
};

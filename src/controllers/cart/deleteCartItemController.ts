import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { CartItem } from '../../models/CartItem.js';
import { notifyAdminsVirtualCartChanged } from '../../sockets/notifyAdminVirtualCart.js';

/**
 * Удаление позиции виртуальной корзины.
 * Обычный пользователь — только свои записи в статусе draft; администратор — любую позицию.
 */
export const deleteCartItemController = async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({
      success: false,
      message: 'Некорректный идентификатор позиции.',
    });
  }

  const item = await CartItem.findById(id);
  if (!item) {
    return res.status(404).json({
      success: false,
      message: 'Позиция не найдена.',
    });
  }

  const { username, role } = req.user!;

  if (role !== 'admin') {
    if (item.username !== username || item.status !== 'draft') {
      return res.status(403).json({
        success: false,
        message: 'Можно удалять только свои позиции в статусе draft.',
      });
    }
  }

  await CartItem.findByIdAndDelete(id);

  notifyAdminsVirtualCartChanged({ reason: 'delete' });

  return res.status(200).json({
    success: true,
    message: 'Позиция удалена из корзины.',
  });
};

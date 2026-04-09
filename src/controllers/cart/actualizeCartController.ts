import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { USER_ROLE } from '../../constants/userRoles.js';
import { logger } from '../../config/logger/index.js';
import { CartItem } from '../../models/CartItem.js';
import { actualizeCartItems } from '../../services/cart/actualizeCartItems.js';
import { notifyAdminsVirtualCartChanged } from '../../sockets/notifyAdminVirtualCart.js';

/**
 * Актуализация позиций виртуальной корзины: проверка цен и наличия у поставщиков.
 * Тело запроса: { cartItemIds: string[] }.
 * Администратор — любые позиции в статусах draft/approved; обычный пользователь — только свои.
 */
export const actualizeCartController = async (req: Request, res: Response) => {
  const { cartItemIds } = req.body as { cartItemIds?: unknown };

  if (
    !Array.isArray(cartItemIds) ||
    cartItemIds.length === 0 ||
    !cartItemIds.every((id) => typeof id === 'string')
  ) {
    return res.status(400).json({
      success: false,
      message: 'Поле cartItemIds обязательно: непустой массив строковых идентификаторов.',
    });
  }

  const uniqueIds = [...new Set(cartItemIds as string[])];
  const invalid = uniqueIds.filter((id) => !mongoose.isValidObjectId(id));
  if (invalid.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Некорректные идентификаторы позиций в cartItemIds.',
    });
  }

  const cartDocs = await CartItem.find({
    _id: { $in: uniqueIds },
    status: { $in: ['draft', 'approved'] },
  }).lean();

  if (cartDocs.length !== uniqueIds.length) {
    return res.status(404).json({
      success: false,
      message: 'Не все позиции найдены или недоступны для актуализации.',
    });
  }

  const { username, role } = req.user!;
  if (role !== USER_ROLE.ADMIN) {
    if (cartDocs.some((doc) => doc.username !== username)) {
      return res.status(403).json({
        success: false,
        message: 'Актуализировать можно только свои позиции виртуальной корзины.',
      });
    }
  }

  const userLogger = logger.child({
    user: req.user!.username,
    action: 'actualize-cart',
  });

  const report = await actualizeCartItems(uniqueIds, userLogger);

  notifyAdminsVirtualCartChanged({ reason: 'actualize' });

  return res.status(200).json({
    success: true,
    message: 'Актуализация завершена.',
    data: report,
  });
};

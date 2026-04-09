import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { CartItem } from '../../models/CartItem.js';
import { notifyAdminsVirtualCartChanged } from '../../sockets/notifyAdminVirtualCart.js';

/**
 * Массовое удаление позиций виртуальной корзины.
 * Сначала проверяем полноту набора id и права на каждую позицию — только потом deleteMany,
 * чтобы не оставлять клиент в частично обновлённом состоянии при отказе в доступе.
 * Правила те же, что у deleteCartItemController: не-админ — только свои draft; админ — любые.
 */
export const deleteCartItemsBulkController = async (req: Request, res: Response) => {
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

  const items = await CartItem.find({ _id: { $in: uniqueIds } });

  if (items.length !== uniqueIds.length) {
    return res.status(404).json({
      success: false,
      message: 'Не все позиции найдены.',
    });
  }

  const { username, role } = req.user!;

  if (role !== 'admin') {
    const forbidden = items.some(
      (item) => item.username !== username || item.status !== 'draft'
    );
    if (forbidden) {
      return res.status(403).json({
        success: false,
        message: 'Можно удалять только свои позиции в статусе draft.',
      });
    }
  }

  await CartItem.deleteMany({ _id: { $in: uniqueIds } });

  notifyAdminsVirtualCartChanged({ reason: 'bulk_delete' });

  const deletedIds = uniqueIds.map((id) => String(id));

  return res.status(200).json({
    success: true,
    message: 'Позиции удалены из корзины.',
    data: { deletedIds },
  });
};

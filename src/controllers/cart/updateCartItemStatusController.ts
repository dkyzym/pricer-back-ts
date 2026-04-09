import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { CartItem, CartItemStatus } from '../../models/CartItem.js';
import { notifyAdminsVirtualCartChanged } from '../../sockets/notifyAdminVirtualCart.js';

/** Статусы, которые администратор может выставить через PATCH (без ordered — отдельный бизнес-процесс). */
const ADMIN_PATCHABLE_STATUSES = ['approved', 'draft', 'cancelled'] as const;

type AdminPatchableStatus = (typeof ADMIN_PATCHABLE_STATUSES)[number];

const isAdminPatchableStatus = (v: unknown): v is AdminPatchableStatus =>
  typeof v === 'string' &&
  (ADMIN_PATCHABLE_STATUSES as readonly string[]).includes(v);

/**
 * Смена статуса позиции виртуальной корзины.
 * Только role === 'admin'; тело запроса: { status: 'approved' | 'draft' | 'cancelled' }.
 */
export const updateCartItemStatusController = async (
  req: Request,
  res: Response
) => {
  if (req.user!.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Изменять статус позиций корзины может только администратор.',
    });
  }

  const { id } = req.params;
  const { status } = req.body as { status?: unknown };

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({
      success: false,
      message: 'Некорректный идентификатор позиции.',
    });
  }

  if (!isAdminPatchableStatus(status)) {
    return res.status(400).json({
      success: false,
      message: `Поле status должно быть одним из: ${ADMIN_PATCHABLE_STATUSES.join(', ')}.`,
    });
  }

  const updated = await CartItem.findByIdAndUpdate(
    id,
    { status: status as CartItemStatus },
    { new: true, runValidators: true }
  ).lean();

  if (!updated) {
    return res.status(404).json({
      success: false,
      message: 'Позиция не найдена.',
    });
  }

  notifyAdminsVirtualCartChanged({ reason: 'status' });

  return res.status(200).json({
    success: true,
    message: 'Статус позиции обновлён.',
    data: updated,
  });
};

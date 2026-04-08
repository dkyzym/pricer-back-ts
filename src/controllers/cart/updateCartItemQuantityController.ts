import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { CartItem } from '../../models/CartItem.js';
import { parseAvailability } from '../../utils/parseAvailability.js';

/**
 * Изменение количества по позиции виртуальной корзины.
 * Доступно только владельцу позиции при статусе draft.
 */
export const updateCartItemQuantityController = async (
  req: Request,
  res: Response
) => {
  const { id } = req.params;
  const { quantity } = req.body as { quantity?: unknown };

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({
      success: false,
      message: 'Некорректный идентификатор позиции.',
    });
  }

  if (
    typeof quantity !== 'number' ||
    !Number.isFinite(quantity) ||
    !Number.isInteger(quantity) ||
    quantity < 1
  ) {
    return res.status(400).json({
      success: false,
      message: 'Поле quantity обязательно: целое число не меньше 1.',
    });
  }

  const item = await CartItem.findById(id);
  if (!item) {
    return res.status(404).json({
      success: false,
      message: 'Позиция не найдена.',
    });
  }

  const { username } = req.user!;

  if (item.username !== username || item.status !== 'draft') {
    return res.status(403).json({
      success: false,
      message: 'Можно менять количество только у своих позиций в статусе draft.',
    });
  }

  const raw = item.rawItemData as Record<string, unknown> | null | undefined;
  const availabilityRaw = raw?.availability;
  if (typeof availabilityRaw === 'number' || typeof availabilityRaw === 'string') {
    const availNum = parseAvailability(availabilityRaw);
    if (availNum !== null && quantity > availNum) {
      return res.status(400).json({
        success: false,
        message: `Запрошенное количество превышает остаток по данным последней актуализации (${availNum} шт.).`,
      });
    }
  }

  item.quantity = quantity;
  await item.save();

  return res.status(200).json({
    success: true,
    message: 'Количество обновлено.',
    data: item,
  });
};

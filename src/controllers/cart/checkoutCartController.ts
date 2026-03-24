import { Request, Response } from 'express';
import { logger } from '../../config/logger/index.js';
import { checkoutCartItems } from '../../services/cart/checkoutCartItems.js';

/**
 * Оформление заказов из виртуальной корзины у поставщиков.
 * Только role === 'admin'; тело запроса: { cartItemIds: string[] }.
 * Позиции должны иметь status 'approved' — актуализация выполняется до вызова.
 */
export const checkoutCartController = async (req: Request, res: Response) => {
  if (req.user!.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Оформление заказов доступно только администратору.',
    });
  }

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

  const userLogger = logger.child({
    user: req.user!.username,
    action: 'checkout-cart',
  });

  const report = await checkoutCartItems(cartItemIds, userLogger);

  return res.status(200).json({
    success: true,
    message: 'Оформление завершено.',
    data: report,
  });
};

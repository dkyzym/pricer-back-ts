import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { logger } from '../../config/logger/index.js';
import { checkoutCartItems } from '../../services/cart/checkoutCartItems.js';
import { notifyAdminsVirtualCartChanged } from '../../sockets/notifyAdminVirtualCart.js';
import type {
  CartCheckoutOptions,
  PatriotPaymentForm,
} from '../../services/orchestration/cart/cart.types.js';

const isPatriotPaymentForm = (v: unknown): v is PatriotPaymentForm =>
  v === 'cash' || v === 'non_cash';

/**
 * Оформление заказов из виртуальной корзины у поставщиков.
 * Тело: { cartItemIds: string[]; patriotPaymentForm?: 'cash' | 'non_cash' }.
 * Права и проверки поставщиков — в checkoutCartItems.
 */
export const checkoutCartController = async (req: Request, res: Response) => {
  const { cartItemIds, patriotPaymentForm } = req.body as {
    cartItemIds?: unknown;
    patriotPaymentForm?: unknown;
  };

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

  if (patriotPaymentForm !== undefined && !isPatriotPaymentForm(patriotPaymentForm)) {
    return res.status(400).json({
      success: false,
      message: 'Поле patriotPaymentForm должно быть «cash» или «non_cash».',
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

  const userLogger = logger.child({
    user: req.user!.username,
    action: 'checkout-cart',
  });

  const { username, role } = req.user!;
  const checkoutOptions: CartCheckoutOptions | undefined =
    patriotPaymentForm !== undefined ? { patriotPaymentForm } : undefined;

  const report = await checkoutCartItems(
    uniqueIds,
    { username, role },
    userLogger,
    checkoutOptions,
  );

  notifyAdminsVirtualCartChanged({ reason: 'checkout' });

  return res.status(200).json({
    success: true,
    message: 'Оформление завершено.',
    data: report,
  });
};

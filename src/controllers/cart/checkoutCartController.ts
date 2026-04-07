import { Request, Response } from 'express';
import { logger } from '../../config/logger/index.js';
import { CartItem } from '../../models/CartItem.js';
import { checkoutCartItems } from '../../services/cart/checkoutCartItems.js';
import type {
  CartCheckoutOptions,
  PatriotPaymentForm,
} from '../../services/orchestration/cart/cart.types.js';

/** Как в abcpCheckoutService.checkoutEnvOptional — для валидации перед чекаутом. */
const envNonEmpty = (name: string): string | undefined => {
  const v = process.env[name];
  if (v === undefined || v === null) return undefined;
  const t = v.trim();
  return t.length > 0 ? t : undefined;
};

const isPatriotPaymentForm = (v: unknown): v is PatriotPaymentForm =>
  v === 'cash' || v === 'non_cash';

/**
 * Оформление заказов из виртуальной корзины у поставщиков.
 * Только role === 'admin'; тело: { cartItemIds: string[]; patriotPaymentForm?: 'cash' | 'non_cash' }.
 * Позиции должны иметь status 'approved' — актуализация выполняется до вызова.
 */
export const checkoutCartController = async (req: Request, res: Response) => {
  if (req.user!.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Оформление заказов доступно только администратору.',
    });
  }

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

  const cartDocs = await CartItem.find({
    _id: { $in: cartItemIds },
    status: { $in: ['draft', 'approved'] },
  }).lean();

  const hasPatriot = cartDocs.some((doc) => doc.supplier === 'patriot');
  if (hasPatriot) {
    const form: PatriotPaymentForm = patriotPaymentForm ?? 'non_cash';
    if (form === 'cash' && !envNonEmpty('PATRIOT_PAYMENT_METHOD_ID')) {
      return res.status(400).json({
        success: false,
        message:
          'Для оформления Patriot наличными задайте PATRIOT_PAYMENT_METHOD_ID в окружении сервера.',
      });
    }
    if (form === 'non_cash' && !envNonEmpty('PATRIOT_PAYMENT_METHOD_ID_BN')) {
      return res.status(400).json({
        success: false,
        message:
          'Для оформления Patriot безналом задайте PATRIOT_PAYMENT_METHOD_ID_BN в окружении сервера.',
      });
    }
  }

  const userLogger = logger.child({
    user: req.user!.username,
    action: 'checkout-cart',
  });

  const checkoutOptions: CartCheckoutOptions | undefined =
    patriotPaymentForm !== undefined ? { patriotPaymentForm } : undefined;

  const report = await checkoutCartItems(cartItemIds, userLogger, checkoutOptions);

  return res.status(200).json({
    success: true,
    message: 'Оформление завершено.',
    data: report,
  });
};

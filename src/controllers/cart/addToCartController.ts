import { Request, Response } from 'express';
import { CartHandler, UnifiedCartRequest } from '../../services/cart/cart.types.js';
import { cartSupplierHandlers } from '../../services/cart/cartHandlers.js';

export const addToCartController = async (req: Request, res: Response) => {
  const { supplier } = req.body as UnifiedCartRequest;

  const handler: CartHandler | undefined = cartSupplierHandlers[supplier];

  if (!handler) {
    return res.status(400).json({
      success: false,
      message: `Поставщик '${supplier}' не поддерживается для этой операции.`,
    });
  }

  try {
    const result = await handler(req.body as UnifiedCartRequest);

    return res.status(200).json(result);
  } catch (error) {
    console.error(`Ошибка при добавлении в корзину ${supplier}:`, error);
    return res.status(500).json({
      success: false,
      message: (error as Error).message || 'Внутренняя ошибка сервера',
    });
  }
};

import { Request, Response } from 'express';
import {
  CART_LIST_PAGINATION,
  getCartItems,
} from '../../services/cart/getCartItemsService.js';

const parsePositiveInt = (value: unknown, fallback: number): number | null => {
  if (value === undefined || value === '') return fallback;
  const n = Number.parseInt(String(value), 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
};

/**
 * GET /cart — позиции виртуальной корзины (пагинация: query `limit`, `skip` или `offset`).
 * Контроллер: разбор HTTP и ответ; бизнес-логика в getCartItems.
 */
export const getCartController = async (req: Request, res: Response) => {
  const { username, role } = req.user!;

  const skipRaw = req.query.skip ?? req.query.offset;
  const skipParsed = parsePositiveInt(skipRaw, 0);
  const limitParsed = parsePositiveInt(req.query.limit, CART_LIST_PAGINATION.DEFAULT_LIMIT);

  if (skipParsed === null || limitParsed === null) {
    return res.status(400).json({
      success: false,
      message: 'Некорректные параметры пагинации: ожидаются неотрицательные целые limit и skip/offset.',
    });
  }

  if (limitParsed === 0) {
    return res.status(400).json({
      success: false,
      message: 'Параметр limit должен быть больше 0.',
    });
  }

  const limit = Math.min(limitParsed, CART_LIST_PAGINATION.MAX_LIMIT);
  const skip = skipParsed;

  const result = await getCartItems({
    username,
    role,
    pagination: { limit, skip },
  });

  return res.status(200).json({
    success: true,
    data: result.items,
    meta: {
      total: result.total,
      limit: result.limit,
      skip: result.skip,
    },
  });
};

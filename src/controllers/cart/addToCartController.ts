import { Request, Response } from 'express';
import { UnifiedCartRequest } from '../../services/orchestration/cart/cart.types.js';
import { CartItem } from '../../models/CartItem.js';

/**
 * Виртуальная корзина: сохраняет позицию в MongoDB вместо отправки поставщику.
 * Фактический заказ у поставщика будет оформлен позже, после одобрения (approve flow).
 */
export const addToCartController = async (req: Request, res: Response) => {
  const username = req.user!.username;
  const { supplier, quantity, item } = req.body as UnifiedCartRequest;

  if (!supplier || !quantity || !item) {
    return res.status(400).json({
      success: false,
      message: 'Поля supplier, quantity и item обязательны.',
    });
  }

  const article = item.article ?? item.number;
  const brand = item.brand;
  const name = item.name ?? item.description ?? '';
  const initialPrice = item.price ?? 0;

  if (!article || !brand) {
    return res.status(400).json({
      success: false,
      message: 'item должен содержать article (или number) и brand.',
    });
  }

  const cartItem = await CartItem.create({
    username,
    supplier,
    article,
    brand,
    name,
    quantity,
    initialPrice,
    rawItemData: item,
  });

  return res.status(201).json({
    success: true,
    message: 'Товар добавлен в виртуальную корзину.',
    data: cartItem,
  });
};

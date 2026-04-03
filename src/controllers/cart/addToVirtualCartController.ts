import { Request, Response } from 'express';
import { CartItem } from '../../models/CartItem.js';
import { UnifiedCartRequest } from '../../services/orchestration/cart/cart.types.js';

/**
 * Виртуальная корзина: сохраняет позицию в MongoDB без вызова поставщика.
 * Производственный поток «добавить в корзину поставщика» остаётся на POST /cart/add.
 */
export const addToVirtualCartController = async (req: Request, res: Response) => {
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

  // ug_f — тот же UG: в документе supplier = ug; в rawItemData нужен ключ `ug`, иначе buildCartPosition ищет item[supplier] и не находит item.ug_f.
  const docSupplier = supplier === 'ug_f' ? 'ug' : supplier;
  const rawItemData =
    (supplier === 'ug' || supplier === 'ug_f') && typeof item === 'object' && item !== null
      ? {
          ...(item as Record<string, unknown>),
          supplier: 'ug',
          ug:
            (item as { ug?: unknown; ug_f?: unknown }).ug ??
            (item as { ug_f?: unknown }).ug_f,
        }
      : item;

  const cartItem = await CartItem.create({
    username,
    supplier: docSupplier,
    article,
    brand,
    name,
    quantity,
    initialPrice,
    rawItemData,
  });

  return res.status(201).json({
    success: true,
    message: 'Товар добавлен в виртуальную корзину.',
    data: cartItem,
  });
};

import { Request, Response } from 'express';
import { CartHandler } from './cart.types.js';
import { cartSupplierHandlers } from './cartHandlers.js';

export const addToCartController = async (req: Request, res: Response) => {
  const { supplier } = req.body;

  // 1. ВЫБОР СТРАТЕГИИ
  const handler: CartHandler | undefined = cartSupplierHandlers[supplier];

  // 2. ПРОВЕРКА
  if (!handler) {
    return res.status(400).json({
      success: false,
      message: `Поставщик '${supplier}' не поддерживается для этой операции.`,
    });
  }

  try {
    // 3. ВЫПОЛНЕНИЕ СТРАТЕГИИ
    // Мы не знаем, ЧТО он делает, мы просто ждем от него наш "контракт"
    const result = await handler(req.body);

    // 4. ОТВЕТ: Отправляем уже готовый, адаптированный результат
    return res.status(200).json(result);
  } catch (error) {
    // 5. ОБРАБОТКА ОШИБОК: Если что-то сломалось *внутри* стратегии
    console.error(`Ошибка при добавлении в корзину ${supplier}:`, error);
    return res.status(500).json({
      success: false,
      message: (error as Error).message || 'Внутренняя ошибка сервера',
    });
  }
};

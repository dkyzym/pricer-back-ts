import { Request, Response } from 'express';
import { addToCartProfitService } from 'services/profit/addToCartProfitService';

export const addToCartController = async (req: Request, res: Response) => {
  const { id, warehouse, quantity, code, supplier } = req.body;

  // Проверка, что поставщик является 'profit'
  if (supplier === 'profit') {
    try {
      // Вызов сервиса для добавления в корзину
      const result = await addToCartProfitService({
        id,
        warehouse,
        quantity,
        code,
      });

      // Отправка успешного ответа с данными от сервиса
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Ошибка при добавлении в корзину:', error);
      res.status(500).json({
        success: false,
        message: 'Ошибка при добавлении в корзину',
      });
    }
  } else {
    // Обработка случая неподдерживаемого поставщика
    res.status(400).json({
      success: false,
      message: 'Неподдерживаемый поставщик',
    });
  }
};

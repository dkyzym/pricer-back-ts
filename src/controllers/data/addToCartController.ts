import { Request, Response } from 'express';
import { addToCartProfitService } from 'services/profit/addToCartProfitService';
import { addToCartUgService } from '../../services/ug/cart/addToCartUgService';
import { BasketPositionUG, SupplierName } from '../../types';

export const addToCartController = async (req: Request, res: Response) => {
  const { supplier }: { supplier: SupplierName } = req.body;

  if (supplier === 'profit') {
    const { id, warehouse, quantity, code } = req.body;

    try {
      const result = await addToCartProfitService({
        id,
        warehouse,
        quantity,
        code,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error(`Ошибка при добавлении в корзину ${supplier}:`, error);
      res.status(500).json({
        success: false,
        message: 'Ошибка при добавлении в корзину',
      });
    }
  } else if (supplier === 'ug') {
    const { brand, supplierCode, quantity, itemKey, number } = req.body;

    if (!brand || !supplierCode || !quantity || !itemKey || !number) {
      return res.status(400).json({
        success: false,
        message: 'Некоторые обязательные поля отсутствуют',
      });
    }

    const position: BasketPositionUG = {
      brand,
      supplierCode,
      quantity,
      itemKey,
      number,
    };

    try {
      const result = await addToCartUgService([position]);
      console.log(result);
      res.status(200).json({
        success: Boolean(result.status),
        message: result.positions[0]?.errorMessage || 'Товар добавлен',
      });
    } catch (error) {
      console.error(`Ошибка при добавлении в корзину ${supplier}:`, error);
      res.status(500).json({
        success: false,
        message: 'Ошибка при добавлении в корзину',
      });
    }
  } else {
    res.status(400).json({
      success: false,
      message: 'Неподдерживаемый поставщик',
    });
  }
};

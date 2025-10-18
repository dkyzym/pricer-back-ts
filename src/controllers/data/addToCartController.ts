import { Request, Response } from 'express';
import { addToCartProfitService } from 'services/profit/addToCartProfitService.js';
import { addToCartAutosputnikService } from '../../services/autosputnik/cart/addToCartAutosputnikService.js';
import { getAutosputnikCart } from '../../services/autosputnik/cart/getAutosputnikCart.js';
import { addToCartPatriotNpnService } from '../../services/patriot/cart/addToCartPatriotNpnService.js';

import { addToCartAutosputnikData } from '../../services/autosputnik/autosputnik.types.js';
import { addToCartUgService } from '../../services/ug/cart/addToCartUgService.js';
import { BasketPositionUG } from '../../types/cart.types.js';
import { SupplierName } from '../../types/common.types.js';


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
  } else if (supplier.startsWith('ug')) {
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
      if (supplier === 'ug' || supplier === 'ug_bn' || supplier === 'ug_f') {
        const result = await addToCartUgService([position], supplier);

        res.status(200).json({
          success: Boolean(result.status),
          message: result.positions[0]?.errorMessage || 'Товар добавлен',
        });
      }
    } catch (error) {
      console.error(`Ошибка при добавлении в корзину ${supplier}:`, error);
      res.status(500).json({
        success: false,
        message: 'Ошибка при добавлении в корзину',
      });
    }
  } else if (
    supplier === 'patriot' ||
    supplier === 'npn' ||
    supplier === 'avtodinamika'
  ) {
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
      const result = await addToCartPatriotNpnService([position], supplier);

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
  } else if (supplier === 'autosputnik') {
    const { amount, articul, brand, id_shop_prices, price } = req.body;

    if (!amount || !articul || !brand || !id_shop_prices || !price) {
      return res.status(400).json({
        success: false,
        message: `${supplier} Некоторые обязательные поля отсутствуют`,
      });
    }

    const data: addToCartAutosputnikData = {
      amount,
      articul,
      brand,
      id_shop_prices,
      price,
    };
    try {
      const result = await addToCartAutosputnikService(data);

      const cart = await getAutosputnikCart();
      console.log(cart);

      res.status(200).json({
        success: result.requestInfo.Status === 'ok' ? true : false,
        message: result.requestAnswer.added,
      });
    } catch (error) {
      console.log(error);
      res.status(500).json({
        success: false,
        message: 'Ошибка при добавлении в корзину',
      });
    }
    //
  } else {
    res.status(400).json({
      success: false,
      message: 'Неподдерживаемый поставщик',
    });
  }
};

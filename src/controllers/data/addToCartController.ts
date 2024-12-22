import { AxiosError } from 'axios';
import { Request, Response } from 'express';
import { addToCartProfitService } from 'services/profit/addToCartProfitService';
import { addToCartAutosputnikService } from '../../services/autosputnik/cart/addToCartAutosputnikService';
import { getAutosputnikCart } from '../../services/autosputnik/cart/getAutosputnikCart';
import { addToCartTurboCarService } from '../../services/turboCars/api/addToCartTurboCarService';
import { addToCartUgService } from '../../services/ug/cart/addToCartUgService';
import {
  BasketPositionTurboCars,
  BasketPositionUG,
  BasketTurboCarsFrontendData,
  SupplierName,
} from '../../types';
import { addToCartAutosputnikData } from '../../types/autosputnik';

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
      // console.log(result);
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
  } else if (supplier === 'turboCars') {
    const { QTY, StockID, ZakazCode }: BasketTurboCarsFrontendData = req.body;

    try {
      const params: BasketPositionTurboCars = {
        QTY,
        StockID,
        ZakazCode,
        DeliveryType: '0',
        ExpressID: '0',
        Notes: '',
      };
      console.log(JSON.stringify(params));

      const result = await addToCartTurboCarService(params);

      res.status(200).json({
        success: result.AddResult.Message === 'OK' ? true : false,
        message: result.AddResult.Message,
      });

      console.log(result);
    } catch (error) {
      console.log(error as AxiosError);
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

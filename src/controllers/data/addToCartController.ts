import { Request, Response } from 'express';
import { AbcpSupplierAlias } from '../../services/abcp/abcpPlatform.types.js';
import { updateAbcpCart } from '../../services/abcp/api/abcpCartService.js';
import { addToCartAutosputnikData } from '../../services/autosputnik/autosputnik.types.js';
import { addToCartAutosputnikService } from '../../services/autosputnik/cart/addToCartAutosputnikService.js';
import { getAutosputnikCart } from '../../services/autosputnik/cart/getAutosputnikCart.js';
import { addToCartProfitService } from '../../services/profit/addToCartProfitService.js';
import { BasketPositionUG } from '../../types/cart.types.js';
import { SupplierName } from '../../types/common.types.js';

// Type guard для определения, относится ли поставщик к платформе ABCP
const isAbcpSupplier = (supplier: string): supplier is AbcpSupplierAlias => {
  return ['ug', 'ug_f', 'ug_bn', 'patriot', 'npn', 'avtodinamika'].includes(
    supplier
  );
};

export const addToCartController = async (req: Request, res: Response) => {
  const { supplier }: { supplier: SupplierName } = req.body;

  try {
    // Единый блок для всех поставщиков ABCP
    if (isAbcpSupplier(supplier)) {
      const { brand, supplierCode, quantity, itemKey, number } = req.body;

      if (!brand || !supplierCode || !quantity || !itemKey || !number) {
        return res.status(400).json({
          success: false,
          message: 'Некоторые обязательные поля отсутствуют',
        });
      }

      const position: BasketPositionUG = { brand, supplierCode, quantity, itemKey, number };
      const result = await updateAbcpCart([position], supplier);

      return res.status(200).json({
        success: Boolean(result.status),
        message: result.positions[0]?.errorMessage || 'Товар добавлен/обновлен в корзине',
      });
    }

    // Логика для других поставщиков остается без изменений
    if (supplier === 'profit') {
      const { id, warehouse, quantity, code } = req.body;
      const result = await addToCartProfitService({ id, warehouse, quantity, code });
      return res.status(200).json({ success: true, data: result });
    }

    if (supplier === 'autosputnik') {
      const { amount, articul, brand, id_shop_prices, price } = req.body;
      if (!amount || !articul || !brand || !id_shop_prices || !price) {
        return res.status(400).json({
          success: false,
          message: `${supplier} Некоторые обязательные поля отсутствуют`,
        });
      }
      const data: addToCartAutosputnikData = { amount, articul, brand, id_shop_prices, price };
      const result = await addToCartAutosputnikService(data);
      await getAutosputnikCart(); // Assuming this is for debug or has a side-effect
      return res.status(200).json({
        success: result.requestInfo.Status === 'ok',
        message: result.requestAnswer.added,
      });
    }

    // Если поставщик не опознан
    return res.status(400).json({
      success: false,
      message: 'Неподдерживаемый поставщик',
    });

  } catch (error) {
    console.error(`Ошибка при добавлении в корзину ${supplier}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера',
    });
  }
};

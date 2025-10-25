import { updateAbcpCart } from '../../../services/abcp/api/abcpCartService';
import { addToCartProfitService } from '../../../services/profit/addToCartProfitService.js';
import {
  BasketPositionUG,
  CartHandler,
  CartHandlerResponse,
} from './cart.types.js';

const profitCartHandler: CartHandler = async (
  data: any
): Promise<CartHandlerResponse> => {
  const { id, warehouse, quantity, code } = data;

  const result = await addToCartProfitService({
    id,
    warehouse,
    quantity,
    code,
  });

  const status = result.status === 'success' ? true : false;

  const profitMessageMap = {
    success: 'Товар успешно добавлен',
    'no - quantity': 'На складе нет такого количества',
    less: 'Количество должно быть больше нуля',
    error: 'Ошибка добавления, товар не определен',
  };

  return {
    message: profitMessageMap[result.status],
    success: status,
    data: { total: result.total, count: result.count },
  };
};

const abcpCartHandler: CartHandler = async (
  data: any
): Promise<CartHandlerResponse> => {
  const { brand, supplierCode, quantity, itemKey, number, supplier } = data;

  const position: BasketPositionUG = {
    brand,
    supplierCode,
    quantity,
    itemKey,
    number,
  };
  const result = await updateAbcpCart([position], supplier);

  const message =
    result.positions[0]?.errorMessage || 'Товар добавлен/обновлен в корзине';

  return { message: message, success: Boolean(result.status) };
};

export const cartSupplierHandlers: Record<string, CartHandler> = {
  profit: profitCartHandler,

  ug: abcpCartHandler,
  ug_f: abcpCartHandler,
  ug_bn: abcpCartHandler,
  patriot: abcpCartHandler,
  npn: abcpCartHandler,
  avtodinamika: abcpCartHandler,
};

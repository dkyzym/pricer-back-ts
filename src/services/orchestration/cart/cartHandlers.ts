import { AbcpSupplierAlias } from '../../platforms/abcp/abcpPlatform.types.js';
import { updateAbcpCart } from '../../platforms/abcp/api/abcpCartService.js';
import { addAbcpCartParser } from '../../platforms/abcp/parser/abcpCartParserService.js';
import { addAvtopartnerCart } from '../../suppliers/avtopartner/cart/addAvtopartnerCartService.js';
import { addToCartProfitService } from '../../suppliers/profit/addToCartProfitService.js';
import {
  BasketPositionUG,
  CartHandler,
  CartHandlerResponse,
  UnifiedCartRequest,
} from './cart.types.js';

const profitCartHandler: CartHandler = async (
  data: UnifiedCartRequest
): Promise<CartHandlerResponse> => {
  const { quantity, item } = data;

  const result = await addToCartProfitService({
    id: item.innerId,
    warehouse: item.warehouse_id,
    quantity,
    code: item.inner_product_code,
  });

  const status = result.status === 'success';

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
  data: UnifiedCartRequest
): Promise<CartHandlerResponse> => {
  const { supplier, quantity, item } = data;
  const supplierData = item[supplier];
  const itemKey =
    item.itemKey ?? item.inner_product_code ?? supplierData?.itemKey;
  const supplierCode =
    item.supplierCode ?? item.warehouse_id ?? supplierData?.supplierCode;
  const article = item.article ?? item.number;

  const position: BasketPositionUG = {
    brand: item.brand,
    supplierCode,
    quantity,
    itemKey,
    number: article,
  };
  const result = await updateAbcpCart([position], supplier as AbcpSupplierAlias);

  const message =
    result.positions[0]?.errorMessage || 'Товар добавлен/обновлен в корзине';

  return { message: message, success: Boolean(result.status) };
};

const abcpParserCartHandler: CartHandler = async (
  data: UnifiedCartRequest
): Promise<CartHandlerResponse> => {
  const { supplier, quantity, item } = data;
  const supplierData = item[supplier];
  const itemKey =
    item.itemKey ?? item.inner_product_code ?? supplierData?.itemKey;
  const supplierCode =
    item.supplierCode ?? item.warehouse_id ?? supplierData?.supplierCode;
  const article = item.article ?? item.number;

  const position: BasketPositionUG = {
    brand: item.brand,
    supplierCode,
    quantity,
    itemKey,
    number: article,
  };

  const result = await addAbcpCartParser([position], supplier);

  const message =
    result.positions[0]?.errorMessage || 'Товар добавлен/обновлен в корзине';

  return { message: message, success: Boolean(result.status) };
};

const avtopartnerCartHandler: CartHandler = async (
  data: UnifiedCartRequest
): Promise<CartHandlerResponse> => {
  const { supplier, quantity, item } = data;
  const supplierData = item[supplier];
  const itemKey =
    item.itemKey ?? item.inner_product_code ?? supplierData?.itemKey;
  const supplierCode =
    item.supplierCode ?? item.warehouse_id ?? supplierData?.supplierCode;
  const article = item.article ?? item.number;

  const position: BasketPositionUG = {
    brand: item.brand,
    supplierCode,
    quantity,
    itemKey,
    number: article,
  };

  const result = await addAvtopartnerCart([position], supplier);

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

  mikano: abcpParserCartHandler,
  autoImpulse: abcpParserCartHandler,

  avtoPartner: avtopartnerCartHandler,
};

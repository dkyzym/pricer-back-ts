import { AbcpSupplierAlias } from '../../platforms/abcp/abcpPlatform.types.js';
import { updateAbcpCart } from '../../platforms/abcp/api/abcpCartService.js';
import { addToCartHtml } from '../../platforms/abcp/parser/addToCartHtml.js';
import { addAvtopartnerCart } from '../../suppliers/avtopartner/cart/addAvtopartnerCartService.js';
import { addToCartProfitService } from '../../suppliers/profit/addToCartProfitService.js';
import {
  CartHandler,
  CartHandlerResponse,
  UnifiedCartPosition,
  UnifiedCartRequest,
} from './cart.types.js';

/**
 * Извлекает supplierData, itemKey, supplierCode, article из UnifiedCartRequest
 * и собирает объект позиции корзины для ABCP/парсер/автопартнёр.
 */
const buildCartPosition = (data: UnifiedCartRequest): UnifiedCartPosition => {
  const { supplier, quantity, item } = data;
  const supplierData = item[supplier];
  const itemKey =
    item.itemKey ?? item.inner_product_code ?? supplierData?.itemKey;
  const supplierCode =
    item.supplierCode ?? item.warehouse_id ?? supplierData?.supplierCode;
  const article = item.article ?? item.number;

  return {
    brand: item.brand,
    supplierCode,
    quantity,
    itemKey,
    number: article,
  };
};

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
    'no-quantity': 'На складе нет такого количества',
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
  const position = buildCartPosition(data);
  const result = await updateAbcpCart([position], data.supplier as AbcpSupplierAlias);

  const message =
    result.positions[0]?.errorMessage || 'Товар добавлен/обновлен в корзине';

  return { message: message, success: Boolean(result.status) };
};

const abcpParserCartHandler: CartHandler = async (
  data: UnifiedCartRequest
): Promise<CartHandlerResponse> => {
  const position = buildCartPosition(data);
  const result = await addToCartHtml([position], data.supplier);

  const message =
    result.positions[0]?.errorMessage || 'Товар добавлен/обновлен в корзине';

  return { message: message, success: Boolean(result.status) };
};

const avtopartnerCartHandler: CartHandler = async (
  data: UnifiedCartRequest
): Promise<CartHandlerResponse> => {
  const position = buildCartPosition(data);
  const result = await addAvtopartnerCart([position], data.supplier);

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

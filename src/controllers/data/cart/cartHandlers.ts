import { logger } from '../../../config/logger/index.js';
import { updateAbcpCart } from '../../../services/abcp/api/abcpCartService.js';
import { AbcpSupplierAlias } from '../../../services/abcp/abcpPlatform.types.js';
import { addToCartProfitService } from '../../../services/profit/addToCartProfitService.js';
import { createTurboCarsOrder } from '../../../services/turboCars/turboCarsApi.js';
import {
  BasketPositionUG,
  CartHandler,
  CartHandlerResponse,
  TurboCarsOrderCreatePosition,
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

/**
 * TurboCars использует endpoint order:create для добавления товара.
 * Поле `turboCars` в item хранит оригинальные данные оффера (provider_id и др.),
 * сохранённые при парсинге результатов поиска в parseTurboCarsData.
 */
const turboCarsCartHandler: CartHandler = async (
  data: UnifiedCartRequest
): Promise<CartHandlerResponse> => {
  const { quantity, item } = data;

  const providerId: number | undefined =
    item.turboCars?.provider_id ?? (Number(item.warehouse_id) || undefined);
  const price = Number(item.price);

  if (!providerId || !item.brand || !item.article) {
    return {
      success: false,
      message: 'Недостаточно данных для оформления заказа в TurboCars',
    };
  }

  if (isNaN(price) || price <= 0) {
    return {
      success: false,
      message: 'Некорректная цена товара для TurboCars',
    };
  }

  const position: TurboCarsOrderCreatePosition = {
    provider_id: providerId,
    price,
    code: item.article,
    brand: item.brand,
    count: quantity,
  };

  try {
    const result = await createTurboCarsOrder([position], logger);

    if (result.bad_offers?.length) {
      const reason = result.bad_offers[0].reason;
      return {
        success: false,
        message: `Позиция отклонена: ${reason}`,
        data: { order_number: result.order_number },
      };
    }

    return {
      success: true,
      message: 'Заказ успешно создан в TurboCars',
      data: { order_number: result.order_number },
    };
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : 'Неизвестная ошибка TurboCars';
    return { success: false, message: msg };
  }
};

export const cartSupplierHandlers: Record<string, CartHandler> = {
  profit: profitCartHandler,

  ug: abcpCartHandler,
  ug_f: abcpCartHandler,
  ug_bn: abcpCartHandler,
  patriot: abcpCartHandler,
  npn: abcpCartHandler,
  avtodinamika: abcpCartHandler,

  turboCars: turboCarsCartHandler,
};

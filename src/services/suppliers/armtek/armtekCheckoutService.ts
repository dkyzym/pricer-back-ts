import axios, { AxiosError } from 'axios';
import { Logger } from 'winston';
import { ICartItemDocument } from '../../../models/CartItem.js';
import { CheckoutHandler, CheckoutResult } from '../../orchestration/cart/cart.types.js';
import { SearchResponseItem } from './armtek.types.js';

const ARMTEK_BASE_URL =
  process.env.ARMTEK_BASE_URL?.trim().replace(/\/+$/, '');

/**
 * ТЕСТОВЫЙ endpoint для создания заказа — НЕ создаёт реальных финансовых обязательств.
 * При переходе в прод заменить `createTestOrder` на `createOrder`.
 */

interface ArmtekOrderItem {
  PIN: string;
  BRAND: string;
  KEYZAK: string;
  KWMENG: number;
}

interface ArmtekOrderPayload {
  VKORG: string;
  KUNNR_RG: string;
  ITEMS: ArmtekOrderItem[];
}

interface ArmtekOrderResponseItem {
  VBELN?: string;
  PIN?: string;
  BRAND?: string;
}

interface ArmtekOrderResponse {
  STATUS: number;
  MESSAGES?: { TYPE: 'A' | 'E' | 'S' | 'W' | 'I'; TEXT: string }[];
  RESP?: ArmtekOrderResponseItem[];
}

/**
 * Маппинг позиции корзины в формат ITEMS, ожидаемый Armtek order API.
 * KEYZAK извлекается из rawItemData (исходный объект результата поиска),
 * остальные поля — из нормализованных полей ICartItemDocument.
 */
const mapCartItemToOrderItem = (item: ICartItemDocument): ArmtekOrderItem => {
  const raw = item.rawItemData as Partial<SearchResponseItem> | undefined;

  return {
    PIN: item.article,
    BRAND: item.brand,
    KEYZAK: raw?.KEYZAK ?? '',
    KWMENG: item.quantity,
  };
};

/**
 * Адаптер оформления заказа Armtek (тестовый endpoint).
 *
 * Поток данных:
 *  1. Маппинг ICartItemDocument[] → ITEMS[] (PIN, BRAND, KEYZAK, KWMENG).
 *  2. POST на ws_order/createTestOrder с Basic Auth.
 *  3. Разбор ответа: STATUS 200 → success, иначе — ошибка из MESSAGES.
 */
export const armtekCheckoutHandler: CheckoutHandler = async (
  items: ICartItemDocument[],
  userLogger: Logger,
): Promise<CheckoutResult> => {
  const cartItemIds = items.map((i) => String(i._id));

  if (items.length === 0) {
    return { success: true, cartItemIds, externalOrderIds: [] };
  }

  const payload: ArmtekOrderPayload = {
    VKORG: '4000',
    KUNNR_RG: '43054443',
    ITEMS: items.map(mapCartItemToOrderItem),
  };

  try {
    const response = await axios.post<ArmtekOrderResponse>(
      `${ARMTEK_BASE_URL}/api/ws_order/createTestOrder?format=json`,
      payload,
      {
        headers: { 'Content-Type': 'application/json' },
        auth: {
          username: process.env.ARMTEK_USERNAME || '',
          password: process.env.ARMTEK_PASSWORD || '',
        },
      },
    );

    const { STATUS, MESSAGES, RESP } = response.data;

    if (STATUS !== 200) {
      const errorTexts =
        MESSAGES?.filter((m) => m.TYPE === 'A' || m.TYPE === 'E')
          .map((m) => m.TEXT)
          .join('; ') ?? 'Неизвестная ошибка';

      userLogger.error('[ArmtekCheckout] Ошибка от API', { STATUS, errorTexts });

      return { success: false, cartItemIds, error: `Armtek STATUS ${STATUS}: ${errorTexts}` };
    }

    const externalOrderIds = (RESP ?? [])
      .map((r) => r.VBELN)
      .filter((id): id is string => !!id);

    return { success: true, cartItemIds, externalOrderIds };
  } catch (error: unknown) {
    const message =
      error instanceof AxiosError
        ? `Armtek request failed: ${error.message}`
        : `Armtek unexpected error: ${String(error)}`;

    userLogger.error('[ArmtekCheckout] Исключение при создании заказа', { error: message });

    return { success: false, cartItemIds, error: message };
  }
};

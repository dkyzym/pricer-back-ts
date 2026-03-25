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

/** Элемент ITEMS для createOrder / createTestOrder (armtek-ws-api.md §3.1). */
type ArmtekCreateOrderItem = {
  PIN: string;
  BRAND: string;
  KWMENG: number;
  KEYZAK?: string;
};

/** Тело POST: как в CreateOrderRequest — поле покупателя KUNRG, не KUNNR_RG (то только для ws_search/search). */
interface ArmtekCreateOrderPayload {
  VKORG: string;
  KUNRG: string;
  ITEMS: ArmtekCreateOrderItem[];
}

interface ArmtekCreateOrderResultRow {
  VBELN?: string;
}

interface ArmtekCreateOrderResultItem {
  RESULT?: ArmtekCreateOrderResultRow[];
}

/** RESP успешного createOrder — см. CreateOrderResponse в документации. */
interface ArmtekCreateOrderRespBody {
  ITEMS?: ArmtekCreateOrderResultItem[];
}

interface ArmtekOrderApiEnvelope {
  STATUS: number;
  MESSAGES?: { TYPE: string; TEXT: string }[];
  RESP: ArmtekCreateOrderRespBody | null;
}

/** KUNRG / KUNNR: значение из .env как в Armtek (без padStart — иначе другой контрагент). */
const resolveArmtekKunrg = (): string =>
  process.env.ARMTEK_KUNNR?.trim() ||
  process.env.KUNNR?.trim() ||
  process.env.ARMTEK_KUNRG?.trim() ||
  process.env.KUNRG?.trim() ||
  '43054443';

const resolveArmtekVkorg = (): string => process.env.VKORG?.trim() || '4000';

/** Тексты MESSAGES с TYPE === E (ошибка API при HTTP 200). */
const collectArmtekErrorTexts = (
  messages: ArmtekOrderApiEnvelope['MESSAGES'],
): string => {
  const fromErrors = messages?.filter((m) => m.TYPE === 'E').map((m) => m.TEXT) ?? [];
  if (fromErrors.length > 0) return fromErrors.join('; ');
  const any = messages?.map((m) => m.TEXT).filter(Boolean) ?? [];
  return any.join('; ') || 'Неизвестная ошибка';
};

const collectVbelnsFromCreateOrderResp = (
  resp: ArmtekCreateOrderRespBody | null | undefined,
): string[] => {
  if (!resp?.ITEMS?.length) return [];
  const ids: string[] = [];
  for (const line of resp.ITEMS) {
    const rows = line.RESULT ?? [];
    for (const row of rows) {
      if (row.VBELN) ids.push(row.VBELN);
    }
  }
  return ids;
};

/**
 * Маппинг позиции корзины в формат ITEMS createOrder.
 * KEYZAK — из rawItemData (search); пустой не отправляем (часто ломает валидацию).
 * KWMENG — целое число по спецификации.
 */
const mapCartItemToOrderItem = (item: ICartItemDocument): ArmtekCreateOrderItem => {
  const raw = item.rawItemData as Partial<SearchResponseItem> | undefined;
  const qty = Math.max(1, Math.floor(Number(item.quantity)) || 1);
  const keyzak = raw?.KEYZAK?.trim();
  const base: ArmtekCreateOrderItem = {
    PIN: String(item.article ?? '').trim(),
    BRAND: String(item.brand ?? '').trim(),
    KWMENG: qty,
  };
  return keyzak ? { ...base, KEYZAK: keyzak } : base;
};

const isArmtekApiLogicalFailure = (data: ArmtekOrderApiEnvelope): boolean => {
  if (data.STATUS !== 200) return true;
  if (data.RESP == null) return true;
  if (data.MESSAGES?.some((m) => m.TYPE === 'E')) return true;
  return false;
};

/**
 * Адаптер оформления заказа Armtek (тестовый endpoint).
 *
 * Поток данных:
 *  1. VKORG / KUNRG из .env без изменения строки (trim только у переменных).
 *  2. Маппинг корзины → ITEMS (PIN, BRAND, KWMENG, опционально KEYZAK).
 *  3. POST createTestOrder; успех только при отсутствии MESSAGES.TYPE=E и непустом RESP.
 *  4. Номера заказов: RESP.ITEMS[].RESULT[].VBELN.
 */
export const armtekCheckoutHandler: CheckoutHandler = async (
  items: ICartItemDocument[],
  userLogger: Logger,
): Promise<CheckoutResult> => {
  const cartItemIds = items.map((i) => String(i._id));

  if (items.length === 0) {
    return { success: true, cartItemIds, externalOrderIds: [] };
  }

  const KUNRG = resolveArmtekKunrg();
  if (!KUNRG) {
    userLogger.error('[ArmtekCheckout] Не задан номер покупателя (KUNNR / ARMTEK_KUNNR / KUNRG в .env)');
    return {
      success: false,
      cartItemIds,
      error: 'Armtek: не настроен KUNRG (задайте KUNNR или ARMTEK_KUNNR в .env)',
    };
  }

  const payload: ArmtekCreateOrderPayload = {
    VKORG: resolveArmtekVkorg(),
    KUNRG,
    ITEMS: items.map(mapCartItemToOrderItem),
  };

  try {
    const response = await axios.post<ArmtekOrderApiEnvelope>(
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

    const data = response.data;

    if (isArmtekApiLogicalFailure(data)) {
      const errorText = collectArmtekErrorTexts(data.MESSAGES);
      userLogger.error('[ArmtekCheckout] Ошибка от API', {
        STATUS: data.STATUS,
        RESP: data.RESP,
        errorText,
      });
      return { success: false, cartItemIds, error: errorText };
    }

    const externalOrderIds = collectVbelnsFromCreateOrderResp(data.RESP);

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

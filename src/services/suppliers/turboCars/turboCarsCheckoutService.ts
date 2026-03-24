import { Logger } from 'winston';
import { ICartItemDocument } from '../../../models/CartItem.js';
import { CheckoutHandler, CheckoutResult } from '../../orchestration/cart/cart.types.js';
import { TurboCarsOrderCreatePosition } from './turboCars.types.js';
import { createTurboCarsOrder } from './turboCarsApi.js';

interface TurboCarsRawItemData {
  turboCars?: {
    provider_id: number;
  };
}

/**
 * Маппинг позиции корзины → формат TurboCars API (`/order:create`).
 * `provider_id` извлекается из вложенного объекта `rawItemData.turboCars`,
 * который сохраняется при парсинге результатов поиска (parseTurboCarsData).
 */
const mapCartItemToPosition = (
  item: ICartItemDocument,
): TurboCarsOrderCreatePosition | null => {
  const raw = item.rawItemData as TurboCarsRawItemData | undefined;
  const providerId = raw?.turboCars?.provider_id;

  if (providerId == null) return null;

  return {
    provider_id: providerId,
    price: item.currentPrice ?? item.initialPrice,
    code: item.article,
    brand: item.brand,
    count: item.quantity,
  };
};

/**
 * Адаптер оформления заказа TurboCars (тестовый режим, `is_test: 1`).
 *
 * Поток данных:
 *  1. Маппинг ICartItemDocument[] → positions[] (provider_id, price, code, brand, count).
 *  2. POST на /order:create с флагом is_test: 1.
 *  3. Разбор ответа: bad_offers → частичный или полный отказ, иначе — success.
 */
export const turboCarsCheckoutHandler: CheckoutHandler = async (
  items: ICartItemDocument[],
  userLogger: Logger,
): Promise<CheckoutResult> => {
  const cartItemIds = items.map((i) => String(i._id));

  if (items.length === 0) {
    return { success: true, cartItemIds, externalOrderIds: [] };
  }

  const positions: TurboCarsOrderCreatePosition[] = [];
  const skippedIds: string[] = [];

  for (const item of items) {
    const pos = mapCartItemToPosition(item);
    if (pos) {
      positions.push(pos);
    } else {
      skippedIds.push(String(item._id));
    }
  }

  if (positions.length === 0) {
    userLogger.error('[TurboCarsCheckout] Не удалось собрать позиции — provider_id отсутствует', {
      skippedIds,
    });
    return { success: false, cartItemIds, error: 'Нет позиций с provider_id для TurboCars' };
  }

  if (skippedIds.length > 0) {
    userLogger.warn('[TurboCarsCheckout] Пропущены позиции без provider_id', { skippedIds });
  }

  try {
    userLogger.info('[TurboCarsCheckout] Отправка тестового заказа', {
      itemCount: positions.length,
      codes: positions.map((p) => p.code),
    });

    const response = await createTurboCarsOrder(positions, userLogger, 1);

    const badOffers = response.bad_offers ?? [];

    if (badOffers.length > 0) {
      const badSet = new Set(badOffers.map((b) => `${b.code}|${b.brand}`));
      const failedCartItemIds = items
        .filter((item) => badSet.has(`${item.article}|${item.brand}`))
        .map((item) => String(item._id));

      const badDescriptions = badOffers
        .map((b) => `${b.code}/${b.brand}: ${b.reason}`)
        .join('; ');

      userLogger.warn('[TurboCarsCheckout] Часть позиций отклонена (bad_offers)', {
        orderNumber: response.order_number,
        badOffers,
        failedCartItemIds,
      });

      if (badOffers.length >= positions.length) {
        return {
          success: false,
          cartItemIds,
          error: `Все позиции отклонены: ${badDescriptions}`,
        };
      }

      return {
        success: true,
        cartItemIds,
        externalOrderIds: [response.order_number],
        error: `Отклонённые позиции: ${badDescriptions}`,
      };
    }

    userLogger.info('[TurboCarsCheckout] Тестовый заказ создан', {
      orderNumber: response.order_number,
    });

    return { success: true, cartItemIds, externalOrderIds: [response.order_number] };
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : `TurboCars unexpected error: ${String(error)}`;

    userLogger.error('[TurboCarsCheckout] Исключение при создании заказа', { error: message });

    return { success: false, cartItemIds, error: message };
  }
};

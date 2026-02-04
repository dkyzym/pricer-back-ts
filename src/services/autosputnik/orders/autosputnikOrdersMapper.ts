import { OrderStatus, UnifiedOrderItem } from '../../orders/orders.types.js';
import { AutosputnikGetOrdersResponse } from '../autosputnik.types.js';

/**
 * Маппинг ID статусов Autosputnik в наш единый OrderStatus
 */
const mapAutosputnikStatus = (statusId: number): OrderStatus => {
  switch (statusId) {
    // --- PENDING (Новые, Ожидание) ---
    case 0: // Новый
    case 1: // В резерве
    case 10: // Ожидает оплаты
    case 35: // Ожидается ответ от поставщика
    case 41: // Создан в 1С
      return 'pending';

    // --- WORK (В работе, Заказано) ---
    case 2: // В работе
    case 8: // Заказано поставщику
    case 23: // Отправлен поставщику
    case 32: // Заказ принят
    case 34: // Подтвержден поставщиком
    case 3: // В наборе
    case 11: // Упакован при сборке
      return 'work';

    // --- SHIPPING (В пути, Отгружено) ---
    case 9: // Отгружено поставщиком
    case 13: // Доставляется клиенту
    case 20: // Задержка (но процесс идет)
    case 31: // Доставляется в магазин
    case 36: // Задержка поставки
    case 37: // Доставляется на пункт выдачи
    case 43: // На транзитном складе
    case 44: // Отгружено с транзитного склада
      return 'shipping';

    // --- READY (Пришло, Готово к выдаче) ---
    case 4: // Набран (собран на складе)
    case 25: // На складе
    case 30: // Готов к выдаче оптовику
    case 38: // Готов к выдаче
    case 46: // На выдаче
      return 'ready';

    // --- FINISHED (Выдано) ---
    case 5: // Выдано
    case 29: // Доставлено
      return 'finished';

    // --- REFUSED (Отказ, Снято) ---
    case 6: // Снято
    case 7: // Снято (уточните)
    case 14: // Отказ клиента
    case 15: // Аннулирован
    case 16: // Заказ не возможен
    case 17: // Отмена техническая
    case 18: // Брак
    case 19: // Выдача невозможна
    case 33: // Возвращено клиентом
    case 40: // Ошибка цены
    case 47: // Отказ поставщика
      return 'refused';

    default:
      return 'unknown';
  }
};

/**
 * Преобразует ответ Autosputnik в плоский список UnifiedOrderItem
 */
export const mapAutosputnikOrdersToUnified = (
  rawData: AutosputnikGetOrdersResponse,
  supplierAlias: string
): UnifiedOrderItem[] => {
  if (!rawData.data || !Array.isArray(rawData.data)) {
    return [];
  }

  const result: UnifiedOrderItem[] = [];

  for (const order of rawData.data) {
    if (!order.products) continue;

    for (const product of order.products) {
      // Autosputnik дает дату создания в заказе, а не в продукте
      const createdAtISO = order.date.includes('T')
        ? order.date
        : `${order.date}Z`; // Fallback если формат изменится

      const item: UnifiedOrderItem = {
        id: String(product.id),
        orderId: String(order.id), // Или product.orderid
        supplier: supplierAlias,

        brand: product.brand_name,
        article: product.articul,
        name: product.product_name,

        quantity: product.quantity,
        price: product.price,
        totalPrice: product.amount, // Autosputnik дает готовую сумму
        currency: 'RUB', // По умолчанию RUB, API не отдает валюту явно

        status: mapAutosputnikStatus(product.statusid),
        statusRaw: product.status,

        createdAt: createdAtISO,
        deliveryDate: product.date_delivery || undefined,
        comment: product.comment_product || order.comment,
      };

      result.push(item);
    }
  }

  return result;
};

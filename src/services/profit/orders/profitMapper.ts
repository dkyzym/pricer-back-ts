import { DateTime } from 'luxon';
import { OrderStatus, UnifiedOrderItem } from '../../orders/orders.types.js';
import { ProfitGetOrdersResponse } from '../profit.types.js';

/**
 * Маппинг статусов Profit (ID -> Unified Status)
 */
const mapProfitStatus = (statusId: number): OrderStatus => {
  switch (statusId) {
    case 1: // Принят в работу
    case 16: // Ожидает зачет оплаты
    case 21: // Требует подтверждения
    case 11: // Согласование менеджером
      return 'pending';

    case 4: // Создан заказ поставщику
    case 2: // Заказан поставщику
    case 18: // Зарезервирован до оплаты
    case 3: // Зарезервирован к отгрузке
    case 5: // Выписаны документы
    case 23: // Собран
    case 27: // Срок доставки изменен
      return 'work';

    case 10: // Отправлен поставщиком
    case 12: // Перемещение резерва (наличие)
    case 14: // Перемещение резерва (заказное)
    case 13: // Готов к отгрузке
    case 17: // Задержка поставки
    case 7: // Передан для отгрузки
      return 'shipping';

    case 19: // Готов к выдаче
      return 'ready';

    case 9: // Получен клиентом
      return 'finished';

    case 6: // Отменен
    case 15: // Ошибка!
    case 20: // Возвращен
    case 22: // Рекламация
    case 24:
    case 25:
    case 26: // Заказ будет отменен
      return 'refused';

    default:
      return 'unknown';
  }
};

export const mapProfitOrdersToUnified = (
  rawData: ProfitGetOrdersResponse,
  supplierAlias: string
): UnifiedOrderItem[] => {
  if (!rawData || !rawData.data || !Array.isArray(rawData.data)) {
    return [];
  }

  const result: UnifiedOrderItem[] = [];

  for (const order of rawData.data) {
    if (!order.products || !Array.isArray(order.products)) continue;

    // Парсим дату
    let createdDate = order.datetime;
    const parsedDate = DateTime.fromSQL(order.datetime);
    if (parsedDate.isValid) {
      createdDate = parsedDate.toISO() || order.datetime;
    }

    // Формируем комментарий с типом оплаты
    // Пример: "[Безналичные] Просьба позвонить"
    const paymentPrefix = order.payment_name ? `[${order.payment_name}] ` : '';
    const baseComment = order.comment || '';
    const fullOrderComment = `${paymentPrefix}${baseComment}`.trim();

    for (const product of order.products) {
      // Объединяем комментарий заказа и товара, если нужно, или используем приоритет
      const itemComment = product.comment
        ? `${paymentPrefix}${product.comment}`
        : fullOrderComment;

      const item: UnifiedOrderItem = {
        // id - ID строки товара
        id: String(product.id),

        // orderId - Номер заказа
        orderId: String(order.order_id),

        supplier: supplierAlias,

        brand: product.brand,
        article: product.article,
        name: product.description,

        quantity: Number(product.quantity),
        price: Number(product.price),
        totalPrice: Number(product.price) * Number(product.quantity),
        currency: 'RUB',

        status: mapProfitStatus(Number(product.status_id)),
        statusRaw: product.status,

        createdAt: createdDate,
        deliveryDate: product.delivery_date || undefined,
        comment: itemComment,
      };

      result.push(item);
    }
  }

  return result;
};

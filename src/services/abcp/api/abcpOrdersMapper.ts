import { OrderStatus, UnifiedOrderItem } from '../../orders/orders.types.js';
import { AbcpOrderRaw, AbcpOrdersResponse } from '../abcpPlatform.types.js';

/**
 * Парсит цену или кол-во из строки, которая может быть "1 200,50" или "1200.50"
 */
const parseAbcpNumber = (value: string | number | undefined): number => {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  // Убираем пробелы (разделители тысяч) и меняем запятую на точку
  const cleanStr = value.replace(/\s/g, '').replace(',', '.');
  const result = parseFloat(cleanStr);
  return isNaN(result) ? 0 : result;
};

/**
 * Определяем статус на основе текста из ABCP
 */
const mapAbcpStatus = (statusRaw: string): OrderStatus => {
  const s = (statusRaw || '').toLowerCase();

  if (s.includes('отказ') || s.includes('возврат') || s.includes('снят'))
    return 'refused';
  if (s.includes('выдано') || s.includes('архив') || s.includes('получен'))
    return 'finished';
  // "Готовится к отгрузке" попадает сюда (shipping) или в ready, зависит от логики.
  // Обычно "Готовится к отгрузке" = "Собран на складе поставщика и едет к нам" -> shipping
  if (
    s.includes('пути') ||
    s.includes('транзит') ||
    s.includes('отгрузке') ||
    s.includes('отправка')
  )
    return 'shipping';
  if (s.includes('на склад') || s.includes('готов')) return 'ready';
  if (s.includes('работе') || s.includes('подтвержден') || s.includes('заказ'))
    return 'work';
  if (s.includes('ожидание') || s.includes('модерация')) return 'pending';

  return 'unknown';
};

export const mapAbcpOrdersToUnified = (
  data: AbcpOrdersResponse,
  supplierAlias: string
): UnifiedOrderItem[] => {
  if (!data || !data.items) {
    return [];
  }

  // Превращаем словарь items в массив
  const orders: AbcpOrderRaw[] = Object.values(data.items);
  const result: UnifiedOrderItem[] = [];

  for (const order of orders) {
    // Пропускаем заказы без позиций
    if (!order.positions || !Array.isArray(order.positions)) {
      continue;
    }

    for (const pos of order.positions) {
      const quantity = parseAbcpNumber(pos.quantity);
      const price = parseAbcpNumber(pos.price);

      result.push({
        // Используем positionId, он есть в JSON
        id: String(pos.positionId),
        orderId: String(order.number),
        supplier: supplierAlias,

        brand: pos.brand || '',
        article: pos.number || '', // В JSON это "number"
        name: pos.description || '', // В JSON это "description"

        quantity: quantity,
        price: price,
        totalPrice: price * quantity,
        currency: 'RUB',

        // pos.status - это текст "Готовится к отгрузке"
        status: mapAbcpStatus(pos.status),
        statusRaw: pos.status || 'Unknown',

        createdAt: order.date, // Дата заказа

        // deadline приходит как "0". Если нужно считать дату, надо прибавлять к order.date.
        // Пока оставим undefined, если там 0, чтобы не показывать "1970 год"
        deliveryDate:
          pos.deadline && pos.deadline !== '0' ? pos.deadline : undefined,
      });
    }
  }

  return result;
};

// =========================================================================
//                             УНИФИЦИРОВАННЫЕ ТИПЫ
// =========================================================================

import { SupplierName } from '../../types/common.types.js';

/**
 * Единый список статусов для всех поставщиков.
 * Используем camelCase для удобства в коде.
 */
export type OrderStatus =
  | 'pending' // Создан / В обработке / Отправлен поставщику
  | 'work' // В работе / Подтвержден / Заказано
  | 'shipping' // В пути / Отгружено нам
  | 'ready' // Пришло на наш склад / Готово к выдаче
  | 'finished' // Выдано клиенту / Закрыто / Архив
  | 'refused' // Отказ / Нет в наличии / Снят
  | 'unknown'; // Не удалось распознать статус

/**
 * Единая сущность позиции (строки) заказа.
 * Фронтенд работает ТОЛЬКО с этим типом.
 */
export interface UnifiedOrderItem {
  // --- Идентификаторы ---
  id: string; // Уникальный ID позиции (Autosputnik: id, Profit: id, ABCP: генерируем)
  orderId: string; // Номер заказа (Autosputnik: orderid, Profit: order_id, ABCP: number)
  supplier: string; // Алиас поставщика ('autosputnik', 'profit', 'ug'...)

  // --- Товар ---
  brand: string; // Бренд
  article: string; // Артикул
  name: string; // Наименование

  // --- Финансы и Количество ---
  quantity: number; // Количество
  price: number; // Цена за единицу
  totalPrice: number; // Итоговая сумма строки (важно, т.к. иногда сумма != цена * кол-во из-за округлений)
  currency: string; // Валюта ('RUB' по умолчанию)

  // --- Статус ---
  status: OrderStatus; // Нормализованный статус (для иконок и логики)
  statusRaw: string; // Оригинальный статус от поставщика (для отображения клиенту "как есть")

  // --- Метаданные ---
  createdAt: string; // Дата создания заказа (ISO 8601)
  deliveryDate?: string; // Ожидаемая дата доставки (ISO 8601), если есть
  comment?: string; // Комментарий (если есть)
}

/**
 * Вспомогательный тип для группировки на фронтенде (если понадобится)
 */
export interface UnifiedOrderGroup {
  orderId: string;
  date: string;
  supplier: SupplierName;
  items: UnifiedOrderItem[];
}

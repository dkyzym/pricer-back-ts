import { Logger } from 'winston';
import { abcpArticleSearchResult } from '../../types/index.js';

// --- Вспомогательные утилиты ---
const dayNameToIndex: { [key: string]: number } = {
  вос: 0,
  вс: 0,
  пон: 1,
  пн: 1,
  вто: 2,
  вт: 2,
  сре: 3,
  ср: 3,
  чет: 4,
  чт: 4,
  пят: 5,
  пт: 5,
  суб: 6,
  сб: 6,
};

const getNextDayOfWeek = (startDate: Date, targetDayIndex: number): Date => {
  const resultDate = new Date(startDate.getTime());
  const currentDayIndex = resultDate.getDay();
  const daysToAdd =
    targetDayIndex <= currentDayIndex
      ? 7 + targetDayIndex - currentDayIndex
      : targetDayIndex - currentDayIndex;
  resultDate.setDate(resultDate.getDate() + daysToAdd);
  return resultDate;
};

/**
 * Находит дату следующей отгрузки на основе текущего времени, времени отсечки и дней отгрузки.
 */
const getNextShipmentDate = (
  currentTime: Date,
  cutoffTimeToday: Date,
  shipmentDays: number[]
): Date => {
  let shipmentDate = new Date(currentTime.getTime());

  // Проверяем, успеваем ли мы на отгрузку сегодня
  if (
    shipmentDays.includes(shipmentDate.getDay()) &&
    currentTime.getTime() <= cutoffTimeToday.getTime()
  ) {
    // Да, отгрузка сегодня.
    return shipmentDate;
  }

  // Если не успели, ищем следующий доступный день отгрузки
  while (true) {
    shipmentDate.setDate(shipmentDate.getDate() + 1);
    if (shipmentDays.includes(shipmentDate.getDay())) {
      return shipmentDate;
    }
  }
};

// --- Основная функция расчета часов ---
export const calculateNpnDeadlineHours = (
  originalItem: abcpArticleSearchResult,
  shipmentDays: number[], // Новый параметр: дни отгрузки из конфига
  logger: Logger
): { deadline: number; deadLineMax: number } => {
  const now = new Date();
  const initialDeadline = originalItem.deliveryPeriod || 24;
  const initialDeadlineMax = originalItem.deliveryPeriodMax || initialDeadline;

  if (
    typeof originalItem.deadlineReplace !== 'string' ||
    !originalItem.deadlineReplace.trim()
  ) {
    return { deadline: initialDeadline, deadLineMax: initialDeadlineMax };
  }

  const rule = originalItem.deadlineReplace.toLowerCase();

  try {
    // --- Правило 1: Недельное расписание (без изменений) ---
    const weeklyMatch = rule.match(
      /до\s+(пон|вто|ср|чет|пят|суб|вос)[а-я.]*\s.*?(\d{1,2})[.:-](\d{2}).*?доставка.*?(?:след)[а-я.]*\s+(пон|вто|ср|чет|пят|суб|вос)[а-я]*/
    );
    if (weeklyMatch) {
      // ... логика остается прежней ...
      const [, cutoffDay, cutoffHour, cutoffMinute, deliveryDay] = weeklyMatch;
      const cutoffDayIndex = dayNameToIndex[cutoffDay];
      let cutoffDate = getNextDayOfWeek(now, cutoffDayIndex);
      cutoffDate.setHours(Number(cutoffHour), Number(cutoffMinute), 0, 0);

      if (now.getTime() > cutoffDate.getTime()) {
        cutoffDate.setDate(cutoffDate.getDate() + 7);
      }

      const deliveryDayIndex = dayNameToIndex[deliveryDay];
      const deliveryDate = getNextDayOfWeek(cutoffDate, deliveryDayIndex);
      deliveryDate.setHours(18, 0, 0, 0);

      const hours = Math.ceil(
        (deliveryDate.getTime() - now.getTime()) / 3600000
      );
      return { deadline: hours, deadLineMax: hours + 24 };
    }

    // --- Правило 2 (НОВОЕ): "на наш склад через X дня" ---
    const daysMatch = rule.match(/на наш склад через\s+(\d+)\s+д/);
    if (daysMatch) {
      const days = parseInt(daysMatch[1], 10);
      const hours = days * 24;
      return { deadline: hours, deadLineMax: hours };
    }

    // --- Правило 3 (ОБНОВЛЕННОЕ): "до 10-45" ---
    const dailyMatch = rule.match(/(?:до)?\s*(\d{1,2})[.:-](\d{2})/);
    if (dailyMatch) {
      const [, cutoffHour, cutoffMinute] = dailyMatch;
      const cutoffTimeToday = new Date(now.getTime());
      cutoffTimeToday.setHours(Number(cutoffHour), Number(cutoffMinute), 0, 0);

      // Находим фактическую дату следующей отгрузки
      const nextShipment = getNextShipmentDate(
        now,
        cutoffTimeToday,
        shipmentDays
      );

      // Рассчитываем, сколько часов осталось до этой отгрузки
      const hours = Math.ceil(
        (nextShipment.getTime() - now.getTime()) / 3600000
      );
      return { deadline: hours, deadLineMax: hours };
    }
  } catch (error) {
    logger.error(
      `[NPN] Критическая ошибка при разборе правила: "${rule}"`,
      error
    );
  }

  logger.warn(
    `[NPN] Не удалось распознать правило: "${rule}". Используется расчет по умолчанию.`
  );
  return { deadline: initialDeadline, deadLineMax: initialDeadlineMax };
};

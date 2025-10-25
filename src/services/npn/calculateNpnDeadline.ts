import { DateTime, WeekdayNumbers } from 'luxon';
import { Logger } from 'winston';
import { AbcpArticleSearchResult } from '../abcp/abcpPlatform.types.js';

const dayNameToIndex: { [key: string]: number } = {
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
  вос: 7,
  вс: 7,
};

const dayNamesForRegex = Object.keys(dayNameToIndex).join('|');

const weeklyRuleRegex = new RegExp(
  `(?:до\\s+)?(${dayNamesForRegex})[а-я.]*\\s.*?(\\d{1,2})[.:-](\\d{2}).*?(?:доставка|получение).*?(?:наш\\s+склад\\s+в|в)?\\s*(${dayNamesForRegex})[а-я.]*(?:\\s+после\\s+(\\d{1,2})[.:-](\\d{2}))?`
);

export const calculateNpnDeadlineHours = (
  originalItem: AbcpArticleSearchResult,
  logger: Logger
): { deadline: number; deadLineMax: number } => {
  const now = DateTime.now().setZone('Europe/Moscow');

  const deliveryPeriodHours = originalItem.deliveryPeriod ?? 24;
  const deliveryPeriodMaxHours =
    originalItem.deliveryPeriodMax ?? deliveryPeriodHours;

  if (
    typeof originalItem.deadlineReplace === 'string' &&
    originalItem.deadlineReplace.trim()
  ) {
    const rule = originalItem.deadlineReplace.toLowerCase();
    try {
      const weeklyMatch = rule.match(weeklyRuleRegex);
      if (weeklyMatch) {
        const [
          ,
          cutoffDayStr,
          cutoffHour,
          cutoffMinute,
          deliveryDayStr,
          deliveryHourStr,
          deliveryMinuteStr,
        ] = weeklyMatch;

        const cutoffDayIndex = dayNameToIndex[cutoffDayStr] as WeekdayNumbers;
        const deliveryDayIndex = dayNameToIndex[
          deliveryDayStr
        ] as WeekdayNumbers;

        let cutoffDate = now.set({
          weekday: cutoffDayIndex,
          hour: Number(cutoffHour),
          minute: Number(cutoffMinute),
          second: 0,
          millisecond: 0,
        });
        if (now > cutoffDate) cutoffDate = cutoffDate.plus({ weeks: 1 });

        let deliveryDate = cutoffDate.set({ weekday: deliveryDayIndex });
        if (deliveryDate <= cutoffDate)
          deliveryDate = deliveryDate.plus({ weeks: 1 });

        // Определяем время прибытия: используем данные из строки или 18:01 по умолчанию
        const deliveryHour = deliveryHourStr ? Number(deliveryHourStr) : 18;
        const deliveryMinute = deliveryMinuteStr
          ? Number(deliveryMinuteStr)
          : 1; // 18:01 как значение "после 18:00"

        const readyTime = deliveryDate.set({
          hour: deliveryHour,
          minute: deliveryMinute,
        });
        const hours = Math.ceil(readyTime.diff(now, 'hours').hours);
        return { deadline: hours, deadLineMax: hours + 24 };
      }

      // ... (остальные правила остаются без изменений)
      const daysMatch = rule.match(/на наш склад через\s+(\d+)\s+д/);
      if (daysMatch) {
        let arrivalDate = now.plus({ days: parseInt(daysMatch[1], 10) });
        if (arrivalDate.weekday === 6)
          arrivalDate = arrivalDate.plus({ days: 2 });
        if (arrivalDate.weekday === 7)
          arrivalDate = arrivalDate.plus({ days: 1 });

        const readyTime = arrivalDate.set({ hour: 9, minute: 0 });
        const hours = Math.ceil(readyTime.diff(now, 'hours').hours);
        return { deadline: hours, deadLineMax: hours };
      }

      const hoursMatch = rule.match(/(\d+)\s+час/);
      if (hoursMatch) {
        const hours = parseInt(hoursMatch[1], 10);
        return { deadline: hours, deadLineMax: hours };
      }

      const dailyMatch = rule.match(/(?:до)?\s*(\d{1,2})[.:-](\d{2})/);
      if (dailyMatch) {
        let processingDay = now;
        const cutoffTimeToday = now.set({
          hour: Number(dailyMatch[1]),
          minute: Number(dailyMatch[2]),
        });

        if (now > cutoffTimeToday || now.weekday > 5) {
          processingDay = processingDay.plus({ days: 1 });
          while (processingDay.weekday > 5) {
            processingDay = processingDay.plus({ days: 1 });
          }
        }
        const readyTime = processingDay.set({ hour: 9, minute: 0 });
        const hours = Math.ceil(readyTime.diff(now, 'hours').hours);
        return { deadline: hours, deadLineMax: hours };
      }

      logger.warn(
        `[NPN] Правило в строке "${rule}" не распознано. Используется значение из deliveryPeriod.`
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(
        `[NPN] Ошибка при разборе правила: "${rule}". ${errorMessage}`
      );
    }
  }

  return { deadline: deliveryPeriodHours, deadLineMax: deliveryPeriodMaxHours };
};

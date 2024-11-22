import { DateTime } from 'luxon';
import { SearchResultsParsed, SupplierConfig } from 'types';

export const suppliersConfig: SupplierConfig[] = [
  {
    supplierName: 'patriot',
    workingDays: [2, 3, 4, 5, 6], // со вторника по субботу
    cutoffTimes: {
      default: '11:30', // Начальный крайний срок
      extended: '20:00', // Второй крайний срок
    },
    processingTime: { days: 0 },
    specialConditions: (currentTime: DateTime, result: SearchResultsParsed) => {
      let deliveryDate: DateTime;

      if (
        currentTime.hour < 11 ||
        (currentTime.hour === 11 && currentTime.minute < 30)
      ) {
        // Заказ до 11:30 - доставка сегодня
        deliveryDate = currentTime;
      } else if (currentTime.hour < 20) {
        // Заказ между 11:30 и 20:00 - доставка на следующий день
        deliveryDate = currentTime.plus({ days: 1 });
      } else {
        // Заказ после 20:00 - доставка через два дня
        deliveryDate = currentTime.plus({ days: 2 });
      }

      // Добавляем специальные условия для warehouse
      if (
        result.warehouse.includes('Донецк') ||
        result.warehouse.includes('Мариуполь')
      ) {
        deliveryDate = deliveryDate.plus({ days: 2 });
      } else if (result.warehouse.includes('Мелитополь')) {
        deliveryDate = deliveryDate.plus({ days: 3 });
      }

      // Корректировка для дней без доставки (воскресенье и понедельник)
      while (deliveryDate.weekday === 1 || deliveryDate.weekday === 7) {
        deliveryDate = deliveryDate.plus({ days: 1 });
      }

      return deliveryDate;
    },
  },
  {
    supplierName: 'ug',
    workingDays: [1, 4], // понедельник и четверг
    cutoffTimes: {
      default: '14:00',
    },
    processingTime: { days: 0 },
    specialConditions: (currentTime: DateTime, result: SearchResultsParsed) => {
      let deliveryDate: DateTime;

      const getNextDeliveryDateFrom = (date: DateTime): DateTime => {
        let nextDate = date;
        while (true) {
          if (nextDate.weekday === 1 || nextDate.weekday === 4) {
            return nextDate;
          }
          nextDate = nextDate.plus({ days: 1 });
        }
      };

      if (result.deadLineMax > 0) {
        // Добавить deadLineMax часов и найти следующий день доставки
        const tentativeDate = currentTime.plus({ hours: result.deadLineMax });
        deliveryDate = getNextDeliveryDateFrom(tentativeDate);
      } else {
        // Заказ до или после 14:00
        if (currentTime.hour < 14) {
          const tentativeDate = currentTime.plus({ days: 1 });
          deliveryDate = getNextDeliveryDateFrom(tentativeDate);
        } else {
          const tentativeDate = currentTime.plus({ days: 2 });
          deliveryDate = getNextDeliveryDateFrom(tentativeDate);
        }
      }

      return deliveryDate;
    },
  },
  {
    supplierName: 'turboCars',
    workingDays: [1, 2, 3, 4, 5, 6], // понедельник - суббота
    cutoffTimes: {
      'РД-3': '12:00',
      default: 'deadLineTimeToOrder', // Крайний срок из данных товара
    },
    processingTime: { days: 0 },
    specialConditions: (currentTime: DateTime, result: SearchResultsParsed) => {
      let deliveryDate: DateTime;

      if (result.warehouse === 'РД-3') {
        if (currentTime.hour < 12) {
          deliveryDate = currentTime;
        } else {
          deliveryDate = currentTime.plus({ days: 1 });
        }
      } else {
        // Разбор 'deadLineTimeToOrder' для получения часа и минуты
        let deadlineHour = 0;
        let deadlineMinute = 0;
        if (result.deadLineTimeToOrder) {
          const [hourStr, minuteStr] = result.deadLineTimeToOrder.split(':');
          deadlineHour = parseInt(hourStr, 10);
          deadlineMinute = parseInt(minuteStr, 10);
        }

        let orderBeforeDeadline = false;

        if (
          currentTime.hour < deadlineHour ||
          (currentTime.hour === deadlineHour &&
            currentTime.minute <= deadlineMinute)
        ) {
          orderBeforeDeadline = true;
        }

        let daysToAdd = result.deadline;

        if (!orderBeforeDeadline) {
          daysToAdd += 1;
        }

        deliveryDate = currentTime.plus({ days: daysToAdd });
      }

      // Корректировка для воскресенья
      while (deliveryDate.weekday === 7) {
        deliveryDate = deliveryDate.plus({ days: 1 });
      }

      return deliveryDate;
    },
  },
  {
    supplierName: 'profit',
    workingDays: [1, 2, 3, 4, 5, 6],
    cutoffTimes: {},
    processingTime: {},
    specialConditions: (currentTime: DateTime, result: SearchResultsParsed) => {
      let deliveryDate: DateTime | '';

      if (result.deliveryDate) {
        deliveryDate = DateTime.fromISO(result.deliveryDate);
      } else {
        deliveryDate = '';
      }

      return deliveryDate;
    },
  },
  {
    supplierName: 'autosputnik',
    workingDays: [1, 2, 3, 4, 5, 6],
    cutoffTimes: {},
    processingTime: {},
    specialConditions: (currentTime: DateTime, result: SearchResultsParsed) => {
      let deliveryDate: DateTime | '';

      if (result.deliveryDate) {
        deliveryDate = DateTime.fromISO(result.deliveryDate);
      } else {
        deliveryDate = '';
      }

      return deliveryDate;
    },
  },
];

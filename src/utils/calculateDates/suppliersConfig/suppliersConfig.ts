import { DateTime } from 'luxon';
import { SearchResultsParsed, SupplierConfig } from 'types/index.js';

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
    workingDays: [1, 4],
    cutoffTimes: { default: '14:00' },
    processingTime: { days: 0 },
    specialConditions: (currentTime: DateTime, result: SearchResultsParsed) => {
      let deliveryDate: DateTime;

      /**
       * Функция ищет ближайший понедельник (weekday=1) или четверг (weekday=4)
       * СТРОГО ПОСЛЕ переданной даты (т. е. если совпадает день, мы его пропускаем).
       */
      const getNextDeliveryDateFrom = (date: DateTime): DateTime => {
        let nextDate = date;
        while (true) {
          // Если это понедельник или четверг
          if (nextDate.weekday === 1 || nextDate.weekday === 4) {
            // Если день совпадает с исходным (по дате), пропускаем его
            // (тем самым не даём выбрать «сегодня»).
            if (nextDate.hasSame(date, 'day')) {
              nextDate = nextDate.plus({ days: 1 });
              continue;
            }
            return nextDate;
          }
          nextDate = nextDate.plus({ days: 1 });
        }
      };

      // Если deadLineMax > 0, сначала прибавляем эти часы к currentTime
      // (в вашем коде это трактуется просто как "часов" без уточнения выходных/праздников).
      if (result.deadLineMax > 0) {
        const tentativeDate = currentTime.plus({ hours: result.deadLineMax });
        deliveryDate = getNextDeliveryDateFrom(tentativeDate);
      } else {
        // Иначе логика «если до 14:00 – сдвигаем на +1 день, если после 14:00 – на +2 дня»
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
  {
    supplierName: 'autoImpulse',
    workingDays: [2, 5], // Вторник и пятница
    cutoffTimes: {
      default: '15:00', // Крайний срок 15:00
    },
    processingTime: { days: 0 },
    specialConditions: (currentTime: DateTime, result: SearchResultsParsed) => {
      let deliveryDate: DateTime;
      const weekday = currentTime.weekday; // 1 = Monday, ..., 7 = Sunday
      const hour = currentTime.hour;
      const minute = currentTime.minute;

      // Функция для получения следующего определенного дня недели
      const getNextWeekday = (
        current: DateTime,
        targetWeekday: number
      ): DateTime => {
        let daysToAdd = (targetWeekday - current.weekday + 7) % 7;
        if (daysToAdd === 0) {
          daysToAdd = 7; // Если сегодня целевой день, выбрать следующий
        }
        return current.plus({ days: daysToAdd });
      };

      if (weekday === 2) {
        // Вторник
        if (hour < 15 || (hour === 15 && minute === 0)) {
          // Заказ до 15:00 во вторник — доставка в среду
          deliveryDate = currentTime.plus({ days: 1 });
        } else {
          // Заказ после 15:00 во вторник — доставка в субботу
          deliveryDate = getNextWeekday(currentTime, 6); // 6 = Saturday
        }
      } else if (weekday === 5) {
        // Пятница
        if (hour < 15 || (hour === 15 && minute === 0)) {
          // Заказ до 15:00 в пятницу — доставка в субботу
          deliveryDate = currentTime.plus({ days: 1 });
        } else {
          // Заказ после 15:00 в пятницу — доставка в следующую среду
          deliveryDate = getNextWeekday(currentTime, 3); // 3 = Wednesday
        }
      } else {
        // В остальные дни — доставка на ближайшую среду или субботу
        const nextWednesday = getNextWeekday(currentTime, 3);
        const nextSaturday = getNextWeekday(currentTime, 6);

        // Выбрать ближайший из двух дней
        if (nextWednesday < nextSaturday) {
          deliveryDate = nextWednesday;
        } else {
          deliveryDate = nextSaturday;
        }
      }

      return deliveryDate;
    },
  },
];

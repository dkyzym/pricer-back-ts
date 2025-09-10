import { DateTime } from 'luxon';
import { SearchResultsParsed, SupplierConfig } from 'types/index.js';

const getNextWorkingDay =
  (allowedWeekdays: number[]) =>
  (from: DateTime): DateTime => {
    let d = from;
    // Сначала проверяем текущий день 'from'
    if (allowedWeekdays.includes(d.weekday)) {
      return d;
    }
    // Если не подошел, ищем следующий
    while (true) {
      d = d.plus({ days: 1 });
      if (allowedWeekdays.includes(d.weekday)) return d;
    }
  };

export const suppliersConfig: SupplierConfig[] = [
  {
    supplierName: 'patriot',

    // Обработка: понедельник–суббота (каждый день кроме воскресенья)
    workingDays: [1, 2, 3, 4, 5, 6],

    cutoffTimes: {
      default: '11:00', // граница для доставки в тот же день
      extended: '18:00', // конец приёма заказов
    },

    processingTime: { days: 0 },

    specialConditions: (
      now: DateTime,
      result: SearchResultsParsed
    ): DateTime => {
      // Дни доставки: вторник–суббота (нет доставки в вс и пн)
      const deliveryDays = [2, 3, 4, 5, 6];

      // Граничные времена
      const cutoffTime = DateTime.fromFormat('11:00', 'HH:mm', {
        zone: now.zone,
      }).set({ year: now.year, month: now.month, day: now.day });

      const orderDeadline = DateTime.fromFormat('18:00', 'HH:mm', {
        zone: now.zone,
      }).set({ year: now.year, month: now.month, day: now.day });

      // Проверяем, можем ли принять заказ
      if (now > orderDeadline) {
        // После 18:00 - заказы не принимаются в тот же день
        // Доставка на следующий рабочий день доставки
        return getNextWorkingDay(deliveryDays)(now.plus({ days: 1 }));
      }

      let deliveryDate: DateTime;

      if (now < cutoffTime) {
        // Заказ до 11:00 → дневная доставка сегодня (13:00-16:00)
        deliveryDate = now;
      } else {
        // Заказ после 11:00 → утренняя доставка завтра (до 12:00)
        deliveryDate = now.plus({ days: 1 });
      }

      // Находим ближайший день доставки (вт-сб)
      return getNextWorkingDay(deliveryDays)(deliveryDate);
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
    supplierName: 'ug_bn',
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
    supplierName: 'ug_f',
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
    supplierName: 'autosputnik_bn',
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
  {
    supplierName: 'npn',
    workingDays: [2, 5], // Дни отгрузки: Вторник и Пятница
    cutoffTimes: {
      default: '15:00', // Время отсечки для отгрузки
    },
    processingTime: { days: 0 },
    specialConditions: (
      currentTime: DateTime,
      result: SearchResultsParsed
    ): DateTime => {
      // 1. Рассчитываем точное время, когда товар будет ГОТОВ к отгрузке на складе NPN
      const readyForShipmentTime = currentTime.plus({
        hours: result.deadline,
      });

      const shipmentDays = [2, 5]; // Вторник, Пятница
      const [cutoffHour, cutoffMinute] = '15:00'.split(':').map(Number);

      // 2. Ищем ближайший день отгрузки, начиная со дня готовности товара
      let nextShipmentDate = readyForShipmentTime.startOf('day');

      // Ищем в цикле (максимум 8 итераций для безопасности)
      for (let i = 0; i < 8; i++) {
        // Проверяем, является ли текущий день днем отгрузки
        if (shipmentDays.includes(nextShipmentDate.weekday)) {
          // Да, это день отгрузки. Создаем объект DateTime для времени отсечки в этот день.
          const cutoffDateTime = nextShipmentDate.set({
            hour: cutoffHour,
            minute: cutoffMinute,
            second: 0,
            millisecond: 0,
          });

          // Проверяем, успевает ли товар (готовый в readyForShipmentTime) к этому времени отсечки
          if (readyForShipmentTime <= cutoffDateTime) {
            // УСПЕВАЕТ! Это наш день отгрузки.
            // Доставка клиенту происходит на следующий день после отгрузки.
            let customerDeliveryDate = cutoffDateTime.plus({ days: 1 });

            // Если день доставки клиенту - воскресенье, переносим на понедельник.
            if (customerDeliveryDate.weekday === 7) {
              customerDeliveryDate = customerDeliveryDate.plus({ days: 1 });
            }
            return customerDeliveryDate;
          }
        }
        // Если это не день отгрузки ИЛИ мы не успели к отсечке,
        // переходим к следующему дню и повторяем проверку.
        nextShipmentDate = nextShipmentDate.plus({ days: 1 });
      }

      // Запасной вариант на случай непредвиденной ошибки в логике
      return currentTime.plus({ days: 10 });
    },
  },
  {
    supplierName: 'mikano',
    workingDays: [1, 5], // Понедельник и пятница
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

      if (weekday === 1) {
        // 1 = понедельник, 5 пятница
        // Пятница
        if (hour < 15 || (hour === 15 && minute === 0)) {
          // Заказ до 15:00 в понедельник — доставка во вторник
          deliveryDate = currentTime.plus({ days: 1 });
        } else {
          // Заказ после 15:00 в понедельник — доставка в субботу
          deliveryDate = getNextWeekday(currentTime, 6); // 6 = Saturday
        }
      } else if (weekday === 5) {
        // Пятница
        if (hour < 15 || (hour === 15 && minute === 0)) {
          // Заказ до 15:00 в пятницу — доставка в субботу
          deliveryDate = currentTime.plus({ days: 1 });
        } else {
          // Заказ после 15:00 в пятницу — доставка в следующий вторник
          deliveryDate = getNextWeekday(currentTime, 2); // 2 = Вторник
        }
      } else {
        // В остальные дни — доставка на ближайший вторник или субботу
        const nextTuesday = getNextWeekday(currentTime, 2);
        const nextSaturday = getNextWeekday(currentTime, 6);

        // Выбрать ближайший из двух дней
        if (nextTuesday < nextSaturday) {
          deliveryDate = nextTuesday;
        } else {
          deliveryDate = nextSaturday;
        }
      }

      return deliveryDate;
    },
  },
  {
    supplierName: 'avtodinamika',
    workingDays: [1, 3, 5],
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
];

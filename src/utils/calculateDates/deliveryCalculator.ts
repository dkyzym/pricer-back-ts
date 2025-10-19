import { DateTime } from 'luxon';

import { ProductProfit } from '../../services/profit/profit.types.js';
import {
  CalculationStrategy,
  DirectFromApiStrategy,
  RuleBasedStrategy,
  ScheduleBasedStrategy,
  ShipmentScheduleBasedStrategy,
  SupplierDatesConfig,
} from '../../types/date.types.js';
import { SearchResultsParsed } from '../../types/search.types.js';

// --- Helper Functions ---

const isSearchResultsParsed = (
  result: SearchResultsParsed | ProductProfit
): result is SearchResultsParsed => {
  return (result as SearchResultsParsed).deadline !== undefined;
};

// ... existing findNextAllowedDay and applyAvoidance functions ...
const findNextAllowedDay = (
  startDate: DateTime,
  allowedWeekdays: number[],
  allowSameDay: boolean
): DateTime => {
  let date = startDate;
  if (!allowSameDay && allowedWeekdays.includes(date.weekday)) {
    date = date.plus({ days: 1 });
  }
  while (!allowedWeekdays.includes(date.weekday)) {
    date = date.plus({ days: 1 });
  }
  return date;
};

const applyAvoidance = (
  date: DateTime,
  config: CalculationStrategy
): DateTime => {
  if (!config.avoidDeliveryWeekdays) return date;
  let finalDate = date;
  while (config.avoidDeliveryWeekdays.includes(finalDate.weekday)) {
    finalDate = finalDate.plus({ days: 1 });
  }
  return finalDate;
};


// --- Strategy Implementations ---

function calculateDirectFromApi(
  config: DirectFromApiStrategy,
  result: SearchResultsParsed | ProductProfit
): DateTime | null {
  const dateValue = result[config.sourceField as keyof typeof result];
  if (typeof dateValue === 'string' && dateValue) {
    return DateTime.fromISO(dateValue);
  }
  return null;
}

// ... existing calculateByRules and calculateBySchedule functions ...
function calculateByRules(
  config: RuleBasedStrategy,
  now: DateTime
): DateTime | null {
  for (const rule of config.rules) {
    const { from, to } = rule.ifPlaced;
    const currentWeekday = now.weekday;

    let isWeekdayMatch = false;
    if (from.weekday <= to.weekday) {
      isWeekdayMatch = currentWeekday >= from.weekday && currentWeekday <= to.weekday;
    } else {
      isWeekdayMatch = currentWeekday >= from.weekday || currentWeekday <= to.weekday;
    }

    if (!isWeekdayMatch) {
      continue;
    }

    const currentTimeStr = now.toFormat('HH:mm');

    let isTimeMatch = false;
    if (currentWeekday === from.weekday && currentWeekday === to.weekday) {
      isTimeMatch = currentTimeStr >= from.time && currentTimeStr <= to.time;
    } else if (currentWeekday === from.weekday) {
      isTimeMatch = currentTimeStr >= from.time;
    } else if (currentWeekday === to.weekday) {
      isTimeMatch = currentTimeStr <= to.time;
    } else {
      isTimeMatch = true;
    }

    if (isTimeMatch) {
      if (rule.thenDeliver.type === 'ON_NEXT_SPECIFIC_WEEKDAY') {
        let delivery = now;
        while (delivery.weekday !== rule.thenDeliver.weekday) {
          delivery = delivery.plus({ days: 1 });
        }
        if (delivery.hasSame(now, 'day')) {
          delivery = delivery.plus({ weeks: 1 });
        }
        return delivery;
      } else if (rule.thenDeliver.type === 'AFTER_DAYS') {
        return now.plus({ days: rule.thenDeliver.days });
      }
    }
  }
  return null;
}

function calculateBySchedule(
  config: ScheduleBasedStrategy,
  result: SearchResultsParsed,
  now: DateTime
): DateTime | null {
  let readyDate: DateTime;
  const calc = config.readinessCalculation;

  if (calc.type === 'FROM_CUTOFF') {
    const cutoffTime = DateTime.fromFormat(calc.cutoffTime, 'HH:mm', {
      zone: now.zone,
    });
    if (now.toLocal() < cutoffTime) {
      readyDate = now.plus(calc.offsetBeforeCutoff);
    } else {
      readyDate = now.plus(calc.offsetAfterCutoff);
    }
  } else if (calc.type === 'PLUS_HOURS_FROM_RESULT') {
    const hours = result[calc.sourceField] as number;
    readyDate = now.plus({ hours: hours > 0 ? hours : 0 });
  } else if (calc.type === 'CONDITIONAL_CUTOFF') {
    const conditionValue = result[calc.conditionField] as number;
    if (conditionValue > 0) {
      const hours = result[calc.positiveCase.sourceField] as number;
      readyDate = now.plus({ hours: hours > 0 ? hours : 0 });
    } else {
      const negCase = calc.negativeCase;
      const cutoffTime = DateTime.fromFormat(negCase.cutoffTime, 'HH:mm', {
        zone: now.zone,
      });
      if (now.toLocal() < cutoffTime) {
        readyDate = now.plus(negCase.offsetBeforeCutoff);
      } else {
        readyDate = now.plus(negCase.offsetAfterCutoff);
      }
    }
  } else {
    return null;
  }

  return findNextAllowedDay(
    readyDate.startOf('day'),
    config.deliveryWeekdays,
    config.allowSameDayDelivery
  );
}

/**
 * NEW: A dedicated parser for NPN's complex delivery strings.
 * It determines the date when an item is ready at the supplier's warehouse.
 * This is a starting point and can be expanded with more complex regex.
 */
function parseNpnDeliveryString(text: string, now: DateTime): DateTime | null {
  if (!text) return null;
  const lowerText = text.toLowerCase();

  // Case 1: 'На складе' (In stock) -> Ready now
  if (lowerText.includes('на складе')) {
    return now;
  }

  // Case 2: 'через X дня/дней/день' or 'X дня/дней/день' (in X days)
  const daysMatch = lowerText.match(/(?:через\s*)?(\d+)\s*(?:дня|дней|день)/);
  if (daysMatch && daysMatch[1]) {
    const days = parseInt(daysMatch[1], 10);
    return now.plus({ days });
  }

  // NOTE: More complex rules like "Среда до 13-00..." would require very
  // advanced regular expressions and logic. The patterns below are examples
  // of how one might start building them. They can be added here as needed.
  /*
  const complexRuleMatch = lowerText.match(/(\S+)\s*до\s*(\d{2}[:|-]\d{2}).*получение\s*(\S+)/);
  if (complexRuleMatch) {
    // ... complex parsing logic to calculate the exact date ...
    // return calculatedDate;
  }
  */

  // If no known pattern matches, we cannot determine the readiness date.
  return null;
}

function calculateByShipmentSchedule(
  config: ShipmentScheduleBasedStrategy,
  result: SearchResultsParsed,
  now: DateTime
): DateTime | null {
  let readyForShipmentTime: DateTime | null;
  const calc = config.readinessCalculation;

  // Reworked readiness calculation
  if (calc.type === 'PLUS_HOURS_FROM_RESULT') {
    const hours = result[calc.sourceField] as number;
    readyForShipmentTime = now.plus({ hours: hours > 0 ? hours : 0 });
  } else if (calc.type === 'PARSE_DELIVERY_STRING') {
    const deliveryString = result[calc.sourceField] as string;
    readyForShipmentTime = parseNpnDeliveryString(deliveryString, now);
  } else {
    return null; // Should not happen with correct config
  }

  if (!readyForShipmentTime) {
    // If parsing failed or date is invalid, we can't proceed.
    return null;
  }

  // The rest of the logic remains the same, using the calculated readiness time.
  let nextShipmentDate = readyForShipmentTime.startOf('day');
  const [cutoffHour, cutoffMinute] = config.shipmentCutoffTime
    .split(':')
    .map(Number);

  for (let i = 0; i < 8; i++) {
    const isShipmentDay = config.shipmentWeekdays.includes(
      nextShipmentDate.weekday
    );

    if (isShipmentDay) {
      const cutoffDateTime = nextShipmentDate.set({
        hour: cutoffHour,
        minute: cutoffMinute,
      });

      if (readyForShipmentTime <= cutoffDateTime) {
        return cutoffDateTime.plus(config.deliveryDelay);
      }
    }
    nextShipmentDate = nextShipmentDate.plus({ days: 1 });
  }

  return null;
}


export const runCalculationEngine = (
  config: SupplierDatesConfig,
  result: SearchResultsParsed | ProductProfit,
  now: DateTime
): DateTime | null => {
  let calculatedDate: DateTime | null = null;
  const { calculation } = config;

  switch (calculation.strategy) {
    case 'DIRECT_FROM_API':
      calculatedDate = calculateDirectFromApi(calculation, result);
      break;
    case 'RULE_BASED':
      calculatedDate = calculateByRules(calculation, now);
      break;
    case 'SCHEDULE_BASED':
      if (isSearchResultsParsed(result)) {
        calculatedDate = calculateBySchedule(calculation, result, now);
      }
      break;
    case 'SHIPMENT_SCHEDULE_BASED':
      if (isSearchResultsParsed(result)) {
        calculatedDate = calculateByShipmentSchedule(calculation, result, now);
      }
      break;
  }

  return calculatedDate && calculatedDate.isValid
    ? applyAvoidance(calculatedDate, calculation)
    : null;
};


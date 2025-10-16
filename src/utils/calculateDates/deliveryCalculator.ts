import { DateTime } from 'luxon';
import { ProductProfit, SearchResultsParsed } from 'types/index.js';
import {
  CalculationStrategy,
  DirectFromApiStrategy,
  RuleBasedStrategy,
  ScheduleBasedStrategy,
  ShipmentScheduleBasedStrategy,
  SupplierDatesConfig,
} from '../../types/dateTypes.js';

// --- Helper Functions ---

const isSearchResultsParsed = (
  result: SearchResultsParsed | ProductProfit
): result is SearchResultsParsed => {
  return (result as SearchResultsParsed).deadline !== undefined;
};

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

/**
 * FIXED: This function now correctly handles time checks and weekday ranges
 * that wrap around the end of the week (e.g., Saturday to Monday).
 */
function calculateByRules(
  config: RuleBasedStrategy,
  now: DateTime
): DateTime | null {
  for (const rule of config.rules) {
    const { from, to } = rule.ifPlaced;
    const currentWeekday = now.weekday;

    let isWeekdayMatch = false;
    if (from.weekday <= to.weekday) {
      // Standard range: e.g., Monday -> Friday
      isWeekdayMatch = currentWeekday >= from.weekday && currentWeekday <= to.weekday;
    } else {
      // Wrap-around range: e.g., Saturday -> Monday
      isWeekdayMatch = currentWeekday >= from.weekday || currentWeekday <= to.weekday;
    }

    if (!isWeekdayMatch) {
      continue; // This rule's weekday range doesn't apply, check the next one.
    }

    // A simple but effective time check using string comparison.
    const currentTimeStr = now.toFormat('HH:mm');
    
    let isTimeMatch = false;
    if (currentWeekday === from.weekday && currentWeekday === to.weekday) {
        // Rule is for a single day
        isTimeMatch = currentTimeStr >= from.time && currentTimeStr <= to.time;
    } else if (currentWeekday === from.weekday) {
        // We are on the first day of a multi-day rule
        isTimeMatch = currentTimeStr >= from.time;
    } else if (currentWeekday === to.weekday) {
        // We are on the last day of a multi-day rule
        isTimeMatch = currentTimeStr <= to.time;
    } else {
        // We are on a day fully inside the range (e.g., Wednesday in a Mon-Fri rule)
        isTimeMatch = true;
    }

    if (isTimeMatch) {
      // The rule's conditions are met! Calculate the delivery date.
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
  return null; // No matching rule was found
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
    return null; // Should not happen with correct config
  }

  return findNextAllowedDay(
    readyDate.startOf('day'),
    config.deliveryWeekdays,
    config.allowSameDayDelivery
  );
}

function calculateByShipmentSchedule(
  config: ShipmentScheduleBasedStrategy,
  result: SearchResultsParsed,
  now: DateTime
): DateTime | null {
  const hours = result[config.readinessCalculation.sourceField] as number;
  const readyForShipmentTime = now.plus({ hours: hours > 0 ? hours : 0 });

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


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

function calculateByRules(
  config: RuleBasedStrategy,
  now: DateTime
): DateTime | null {
  // A full implementation would also check the time part of the rule
  for (const rule of config.rules) {
    const isWeekdayMatch =
      now.weekday >= rule.ifPlaced.from.weekday &&
      now.weekday <= rule.ifPlaced.to.weekday;

    if (isWeekdayMatch) {
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

/**
 * RESTORED: Implements logic for schedule-based suppliers.
 */
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

  // CORRECTLY USING findNextAllowedDay
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
    // RESTORED CASE
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


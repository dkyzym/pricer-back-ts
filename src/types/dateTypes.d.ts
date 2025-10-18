import { DurationLike } from 'luxon';
import { ProductProfit } from '../services/profit/profit.types';
import { SearchResultsParsed } from './search.types';

// Base type for any calculation strategy
interface BaseStrategy {
  // A global rule to shift delivery date if it falls on a non-working day
  avoidDeliveryWeekdays?: number[];
}

/**
 * Strategy 1: The simplest case.
 * The delivery date is taken directly from a field in the API response.
 */
export interface DirectFromApiStrategy extends BaseStrategy {
  strategy: 'DIRECT_FROM_API';
  sourceField: keyof SearchResultsParsed | keyof ProductProfit;
}

/**
 * Strategy 2: Complex rule-based logic.
 * The delivery day depends on the order day and time.
 */
export interface Rule {
  ifPlaced: {
    from: { weekday: number; time: string };
    to: { weekday: number; time: string };
  };
  thenDeliver:
  | {
    type: 'ON_NEXT_SPECIFIC_WEEKDAY';
    weekday: number;
  }
  | {
    type: 'AFTER_DAYS';
    days: number;
  };
}
export interface RuleBasedStrategy extends BaseStrategy {
  strategy: 'RULE_BASED';
  rules: Rule[];
}

/**
 * Strategy 3: Schedule-based logic.
 * Delivery depends on order cutoff times and fixed delivery days.
 */
export interface ScheduleBasedStrategy extends BaseStrategy {
  strategy: 'SCHEDULE_BASED';
  deliveryWeekdays: number[];
  readinessCalculation:
  | {
    type: 'FROM_CUTOFF';
    cutoffTime: string;
    offsetBeforeCutoff: DurationLike;
    offsetAfterCutoff: DurationLike;
  }
  | {
    type: 'PLUS_HOURS_FROM_RESULT';
    sourceField: keyof SearchResultsParsed;
  }
  | {
    type: 'CONDITIONAL_CUTOFF';
    conditionField: keyof SearchResultsParsed;
    positiveCase: {
      type: 'PLUS_HOURS_FROM_RESULT';
      sourceField: keyof SearchResultsParsed;
    };
    negativeCase: {
      type: 'FROM_CUTOFF';
      cutoffTime: string;
      offsetBeforeCutoff: DurationLike;
      offsetAfterCutoff: DurationLike;
    };
  };
  allowSameDayDelivery: boolean;
}

/**
 * Strategy 4: Shipment-based logic.
 * Models suppliers with specific shipment days and times, and a delay before final delivery.
 */
export interface ShipmentScheduleBasedStrategy extends BaseStrategy {
  strategy: 'SHIPMENT_SCHEDULE_BASED';
  readinessCalculation:
  | {
    type: 'PLUS_HOURS_FROM_RESULT';
    sourceField: keyof SearchResultsParsed;
  }
  | {
    // NEW: This type tells the engine to parse a natural language string.
    type: 'PARSE_DELIVERY_STRING';
    sourceField: keyof SearchResultsParsed; // The field containing the string, e.g., 'description'
  };
  shipmentWeekdays: number[];
  shipmentCutoffTime: string;
  deliveryDelay: DurationLike;
}

// A union of all possible strategy configurations
export type CalculationStrategy =
  | DirectFromApiStrategy
  | RuleBasedStrategy
  | ScheduleBasedStrategy
  | ShipmentScheduleBasedStrategy;

// The final, fully-typed supplier configuration object
export interface SupplierDatesConfig {
  supplierName: string;
  calculation: CalculationStrategy;
}


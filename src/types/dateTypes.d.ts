import { DurationLike } from 'luxon';
import { ProductProfit, SearchResultsParsed } from './index.js';

// Base type for any calculation strategy
interface BaseStrategy {
  // A global rule to shift delivery date if it falls on a non-working day
  // For example, if a calculation results in Sunday, and this is [7], it will be moved to Monday.
  avoidDeliveryWeekdays?: number[];
}

/**
 * Strategy 1: The simplest case.
 * The delivery date is taken directly from a field in the API response.
 * Used for: 'profit', 'autosputnik'
 */
export interface DirectFromApiStrategy extends BaseStrategy {
  strategy: 'DIRECT_FROM_API';
  // The field in the result that contains the ISO date string.
  // We use a union of keys from both types to allow flexibility.
  sourceField: keyof SearchResultsParsed | keyof ProductProfit;
}

/**
 * Strategy 2: Complex rule-based logic.
 * The delivery day depends on the order day and time.
 * A set of rules is evaluated in order. The first one that matches wins.
 * Used for: 'autoImpulse', 'mikano', 'avtoPartner'
 */
export interface Rule {
  // Condition: Time window when an order is placed
  ifPlaced: {
    from: { weekday: number; time: string };
    to: { weekday: number; time: string };
  };
  // Action: How to calculate the delivery date
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
 * Used for: 'patriot', 'ug', 'npn'
 */
export interface ScheduleBasedStrategy extends BaseStrategy {
  strategy: 'SCHEDULE_BASED';
  // Days of the week when delivery is possible. (1-Mon, 7-Sun)
  deliveryWeekdays: number[];
  // How to calculate when the product is ready to be shipped.
  readinessCalculation:
    | {
        type: 'FROM_CUTOFF';
        cutoffTime: string;
        // Time to add to order date if placed before cutoff.
        // Using DurationLike allows simple objects like { days: 1 }.
        offsetBeforeCutoff: DurationLike;
        // Time to add to order date if placed after cutoff.
        offsetAfterCutoff: DurationLike;
      }
    | {
        type: 'PLUS_HOURS_FROM_RESULT';
        sourceField: keyof SearchResultsParsed; // e.g., 'deadLineMax', 'deadline'
      }
    | {
        // NEW TYPE: Handles logic that depends on a field's value (e.g., deadLineMax > 0)
        type: 'CONDITIONAL_CUTOFF';
        // The field to check
        conditionField: keyof SearchResultsParsed;
        // Logic to use if conditionField > 0
        positiveCase: {
          type: 'PLUS_HOURS_FROM_RESULT';
          sourceField: keyof SearchResultsParsed;
        };
        // Logic to use if conditionField is 0 or absent
        negativeCase: {
          type: 'FROM_CUTOFF';
          cutoffTime: string;
          offsetBeforeCutoff: DurationLike;
          offsetAfterCutoff: DurationLike;
        };
      };
  // For some suppliers, delivery on the same day is not allowed, even if it's a delivery day.
  allowSameDayDelivery: boolean;
}

/**
 * NEW Strategy 4: Shipment-based logic.
 * Models suppliers with specific shipment days and times, and a delay before final delivery.
 * Used for: 'npn'
 */
export interface ShipmentScheduleBasedStrategy extends BaseStrategy {
  strategy: 'SHIPMENT_SCHEDULE_BASED';
  // How to calculate when the product is ready for shipment consideration.
  readinessCalculation: {
    type: 'PLUS_HOURS_FROM_RESULT';
    sourceField: keyof SearchResultsParsed;
  };
  // Specific days of the week when shipments go out.
  shipmentWeekdays: number[];
  // The cutoff time on a shipment day.
  shipmentCutoffTime: string;
  // The time it takes from shipment to final customer delivery.
  deliveryDelay: DurationLike;
}

// A union of all possible strategy configurations
export type CalculationStrategy =
  | DirectFromApiStrategy
  | RuleBasedStrategy
  | ScheduleBasedStrategy
  | ShipmentScheduleBasedStrategy; // Added the new strategy

// The final, fully-typed supplier configuration object
export interface SupplierDatesConfig {
  supplierName: string;
  calculation: CalculationStrategy;
}


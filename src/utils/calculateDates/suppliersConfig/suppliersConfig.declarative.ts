import { SupplierDatesConfig } from '../../../types/dateTypes.js';

/**
 * Base configuration for suppliers where the delivery date is provided directly by the API.
 */
const directFromApiBase: SupplierDatesConfig['calculation'] = {
  strategy: 'DIRECT_FROM_API',
  sourceField: 'deliveryDate',
  avoidDeliveryWeekdays: [7], // If API returns Sunday, shift to Monday
};

/**
 * Base configuration for 'ug' and 'avtodinamika' type suppliers.
 * This now accurately reflects the original logic using the 'CONDITIONAL_CUTOFF' strategy.
 */
const ugAndAvtodinamikaBaseConfig: SupplierDatesConfig['calculation'] = {
  strategy: 'SCHEDULE_BASED',
  deliveryWeekdays: [1, 4], // Monday, Thursday
  allowSameDayDelivery: false, // Delivery must be strictly after the order day
  avoidDeliveryWeekdays: [7],
  readinessCalculation: {
    type: 'CONDITIONAL_CUTOFF',
    conditionField: 'deadLineMax',
    // if deadLineMax > 0
    positiveCase: {
      type: 'PLUS_HOURS_FROM_RESULT',
      sourceField: 'deadLineMax',
    },
    // if deadLineMax <= 0
    negativeCase: {
      type: 'FROM_CUTOFF',
      cutoffTime: '14:00',
      offsetBeforeCutoff: { days: 1 }, // before 14:00 -> +1 day
      offsetAfterCutoff: { days: 2 }, // after 14:00 -> +2 days
    },
  },
};

export const suppliersConfig: SupplierDatesConfig[] = [
  // --- Strategy 1: DIRECT_FROM_API ---
  { supplierName: 'profit', calculation: directFromApiBase },
  { supplierName: 'autosputnik', calculation: directFromApiBase },
  { supplierName: 'autosputnik_bn', calculation: directFromApiBase },

  // --- Strategy 2: SCHEDULE_BASED ---
  {
    supplierName: 'patriot',
    calculation: {
      strategy: 'SCHEDULE_BASED',
      deliveryWeekdays: [2, 3, 4, 5, 6], // Tue-Sat
      readinessCalculation: {
        type: 'FROM_CUTOFF',
        cutoffTime: '11:00',
        offsetBeforeCutoff: { days: 0 },
        offsetAfterCutoff: { days: 1 },
      },
      allowSameDayDelivery: true,
      avoidDeliveryWeekdays: [7],
    },
  },
  // ACCURATE CONFIGS FOR UG/AVTODINAMIKA
  { supplierName: 'ug', calculation: ugAndAvtodinamikaBaseConfig },
  { supplierName: 'ug_bn', calculation: ugAndAvtodinamikaBaseConfig },
  { supplierName: 'ug_f', calculation: ugAndAvtodinamikaBaseConfig },
  {
    supplierName: 'avtodinamika',
    calculation: ugAndAvtodinamikaBaseConfig,
  },

  // --- Strategy 3: RULE_BASED ---
  {
    supplierName: 'avtoPartner',
    calculation: {
      strategy: 'RULE_BASED',
      avoidDeliveryWeekdays: [7],
      rules: [
        {
          ifPlaced: { from: { weekday: 1, time: '00:00' }, to: { weekday: 1, time: '13:59' } },
          thenDeliver: { type: 'ON_NEXT_SPECIFIC_WEEKDAY', weekday: 2 },
        },
        {
          ifPlaced: { from: { weekday: 1, time: '14:00' }, to: { weekday: 4, time: '13:59' } },
          thenDeliver: { type: 'ON_NEXT_SPECIFIC_WEEKDAY', weekday: 5 },
        },
        {
          ifPlaced: { from: { weekday: 4, time: '14:00' }, to: { weekday: 7, time: '23:59' } },
          thenDeliver: { type: 'ON_NEXT_SPECIFIC_WEEKDAY', weekday: 2 },
        },
      ],
    },
  },
  {
    supplierName: 'autoImpulse',
    calculation: {
      strategy: 'RULE_BASED',
      avoidDeliveryWeekdays: [7],
      rules: [
        {
          ifPlaced: { from: { weekday: 2, time: '00:00' }, to: { weekday: 2, time: '15:00' } },
          thenDeliver: { type: 'AFTER_DAYS', days: 1 }, // Deliver Wed
        },
        {
          ifPlaced: { from: { weekday: 2, time: '15:01' }, to: { weekday: 2, time: '23:59' } },
          thenDeliver: { type: 'ON_NEXT_SPECIFIC_WEEKDAY', weekday: 6 }, // Deliver Sat
        },
        {
          ifPlaced: { from: { weekday: 5, time: '00:00' }, to: { weekday: 5, time: '15:00' } },
          thenDeliver: { type: 'AFTER_DAYS', days: 1 }, // Deliver Sat
        },
        {
          ifPlaced: { from: { weekday: 5, time: '15:01' }, to: { weekday: 5, time: '23:59' } },
          thenDeliver: { type: 'ON_NEXT_SPECIFIC_WEEKDAY', weekday: 3 }, // Deliver next Wed
        },
      ],
    },
  },
  {
    supplierName: 'mikano',
    calculation: {
      strategy: 'RULE_BASED',
      avoidDeliveryWeekdays: [7],
      rules: [
        {
          ifPlaced: { from: { weekday: 1, time: '00:00' }, to: { weekday: 1, time: '15:00' } },
          thenDeliver: { type: 'AFTER_DAYS', days: 1 }, // Deliver Tue
        },
        {
          ifPlaced: { from: { weekday: 1, time: '15:01' }, to: { weekday: 1, time: '23:59' } },
          thenDeliver: { type: 'ON_NEXT_SPECIFIC_WEEKDAY', weekday: 6 }, // Deliver Sat
        },
        {
          ifPlaced: { from: { weekday: 5, time: '00:00' }, to: { weekday: 5, time: '15:00' } },
          thenDeliver: { type: 'AFTER_DAYS', days: 1 }, // Deliver Sat
        },
        {
          ifPlaced: { from: { weekday: 5, time: '15:01' }, to: { weekday: 5, time: '23:59' } },
          thenDeliver: { type: 'ON_NEXT_SPECIFIC_WEEKDAY', weekday: 2 }, // Deliver next Tue
        },
      ],
    },
  },

  // --- Strategy 4 for npn ---
  {
    supplierName: 'npn',
    calculation: {
      strategy: 'SHIPMENT_SCHEDULE_BASED',
      readinessCalculation: {
        type: 'PLUS_HOURS_FROM_RESULT',
        sourceField: 'deadline',
      },
      // When shipments are sent out from the supplier
      shipmentWeekdays: [2, 5], // Tuesday, Friday
      shipmentCutoffTime: '15:00',
      // Time from shipment to customer delivery
      deliveryDelay: { days: 1 },
      // If delivery (+1 day) lands on Sunday, move it to Monday
      avoidDeliveryWeekdays: [7],
    },
  },
];

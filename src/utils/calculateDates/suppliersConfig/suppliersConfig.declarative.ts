import { SupplierDatesConfig } from '../../../types/dateTypes.js';

// ... existing directFromApiBase and ugAndAvtodinamikaBaseConfig ...
const directFromApiBase: SupplierDatesConfig['calculation'] = {
  strategy: 'DIRECT_FROM_API',
  sourceField: 'deliveryDate',
  avoidDeliveryWeekdays: [7],
};
const ugAndAvtodinamikaBaseConfig: SupplierDatesConfig['calculation'] = {
  strategy: 'SCHEDULE_BASED',
  deliveryWeekdays: [1, 4],
  allowSameDayDelivery: false,
  avoidDeliveryWeekdays: [7],
  readinessCalculation: {
    type: 'CONDITIONAL_CUTOFF',
    conditionField: 'deadLineMax',
    positiveCase: {
      type: 'PLUS_HOURS_FROM_RESULT',
      sourceField: 'deadLineMax',
    },
    negativeCase: {
      type: 'FROM_CUTOFF',
      cutoffTime: '14:00',
      offsetBeforeCutoff: { days: 1 },
      offsetAfterCutoff: { days: 2 },
    },
  },
};


export const suppliersConfig: SupplierDatesConfig[] = [
  // ... other suppliers ...
  { supplierName: 'profit', calculation: directFromApiBase },
  { supplierName: 'autosputnik', calculation: directFromApiBase },
  { supplierName: 'autosputnik_bn', calculation: directFromApiBase },
  {
    supplierName: 'patriot',
    calculation: {
      strategy: 'SCHEDULE_BASED',
      deliveryWeekdays: [2, 3, 4, 5, 6],
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
  { supplierName: 'ug', calculation: ugAndAvtodinamikaBaseConfig },
  { supplierName: 'ug_bn', calculation: ugAndAvtodinamikaBaseConfig },
  { supplierName: 'ug_f', calculation: ugAndAvtodinamikaBaseConfig },
  {
    supplierName: 'avtodinamika',
    calculation: ugAndAvtodinamikaBaseConfig,
  },
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
          thenDeliver: { type: 'AFTER_DAYS', days: 1 },
        },
        {
          ifPlaced: { from: { weekday: 2, time: '15:01' }, to: { weekday: 2, time: '23:59' } },
          thenDeliver: { type: 'ON_NEXT_SPECIFIC_WEEKDAY', weekday: 6 },
        },
        {
          ifPlaced: { from: { weekday: 5, time: '00:00' }, to: { weekday: 5, time: '15:00' } },
          thenDeliver: { type: 'AFTER_DAYS', days: 1 },
        },
        {
          ifPlaced: { from: { weekday: 5, time: '15:01' }, to: { weekday: 5, time: '23:59' } },
          thenDeliver: { type: 'ON_NEXT_SPECIFIC_WEEKDAY', weekday: 3 },
        },
        {
            ifPlaced: { from: { weekday: 3, time: '00:00'}, to: { weekday: 4, time: '23:59'}},
            thenDeliver: { type: 'ON_NEXT_SPECIFIC_WEEKDAY', weekday: 6}
        },
        {
            ifPlaced: { from: { weekday: 6, time: '00:00'}, to: { weekday: 1, time: '23:59'}},
            thenDeliver: { type: 'ON_NEXT_SPECIFIC_WEEKDAY', weekday: 3}
        }
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
          thenDeliver: { type: 'AFTER_DAYS', days: 1 },
        },
        {
          ifPlaced: { from: { weekday: 1, time: '15:01' }, to: { weekday: 1, time: '23:59' } },
          thenDeliver: { type: 'ON_NEXT_SPECIFIC_WEEKDAY', weekday: 6 },
        },
        {
          ifPlaced: { from: { weekday: 5, time: '00:00' }, to: { weekday: 5, time: '15:00' } },
          thenDeliver: { type: 'AFTER_DAYS', days: 1 },
        },
        {
          ifPlaced: { from: { weekday: 5, time: '15:01' }, to: { weekday: 5, time: '23:59' } },
          thenDeliver: { type: 'ON_NEXT_SPECIFIC_WEEKDAY', weekday: 2 },
        },
        {
            ifPlaced: { from: { weekday: 2, time: '00:00'}, to: { weekday: 4, time: '23:59'}},
            thenDeliver: { type: 'ON_NEXT_SPECIFIC_WEEKDAY', weekday: 6}
        },
        {
            ifPlaced: { from: { weekday: 6, time: '00:00'}, to: { weekday: 7, time: '23:59'}},
            thenDeliver: { type: 'ON_NEXT_SPECIFIC_WEEKDAY', weekday: 2}
        }
      ],
    },
  },

  // --- CORRECTED NPN CONFIGURATION ---
  {
    supplierName: 'npn',
    calculation: {
      strategy: 'SHIPMENT_SCHEDULE_BASED',
      // We now trust the pre-calculated hours in the `deadline` field.
      readinessCalculation: {
        type: 'PLUS_HOURS_FROM_RESULT',
        sourceField: 'deadline', // Use the pre-calculated hours from the deadline field
      },
      // The rest of the logic remains the same. The engine will:
      // 1. Get readiness date by adding `deadline` hours to the current time.
      // 2. Find the next shipment day (Tue/Fri) after that date, respecting the cutoff time.
      // 3. Add the delivery delay.
      shipmentWeekdays: [2, 5], // Tuesday, Friday
      shipmentCutoffTime: '15:00',
      deliveryDelay: { days: 1 },
      avoidDeliveryWeekdays: [7],
    },
  },
];


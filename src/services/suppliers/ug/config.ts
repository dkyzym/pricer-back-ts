import { Logger } from 'winston';
import { AbcpMapperConfig } from '../../platforms/abcp/abcpResponseMapper.js';

/** Конфигурация маппера для поставщика UG (ug, ug_f, ug_bn) */
export const ugConfig: AbcpMapperConfig = {
  getWarehouse: (item) => item.supplierDescription ?? '',
  getProbability: (item) => {
    const ownWarehouses = ['краснодар', 'ростов'];
    const supplierDescriptionLower = (
      item.supplierDescription ?? ''
    ).toLowerCase();
    return ownWarehouses.some((w) => supplierDescriptionLower.includes(w))
      ? 95
      : (item.deliveryProbability ?? 0);
  },
  getDeadlines: (item, _logger: Logger) => ({
    deadline: item.deliveryPeriod || 1,
    deadLineMax: (item.deliveryPeriodMax || item.deliveryPeriod || 1) as number,
  }),
};

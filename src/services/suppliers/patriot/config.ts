import { Logger } from 'winston';
import { AbcpMapperConfig } from '../../platforms/abcp/abcpResponseMapper.js';

/** Конфигурация маппера для поставщика Patriot */
export const patriotConfig: AbcpMapperConfig = {
  getWarehouse: (item) => item.supplierDescription ?? '',
  getProbability: (_item) => 95,
  getDeadlines: (item, _logger: Logger) => ({
    deadline: item.deliveryPeriod || 24,
    deadLineMax: (item.deliveryPeriodMax || item.deliveryPeriod || 24) as number,
  }),
};

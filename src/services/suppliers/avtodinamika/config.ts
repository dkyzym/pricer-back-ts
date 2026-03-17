import { Logger } from 'winston';
import { AbcpMapperConfig } from '../../platforms/abcp/abcpResponseMapper.js';

/** Конфигурация маппера для поставщика Avtodinamika */
export const avtodinamikaConfig: AbcpMapperConfig = {
  getWarehouse: (item) => (item.deliveryPeriod === 0 ? 'СВОЙ' : 'ЧУЖОЙ СКЛАД'),
  getProbability: (item) => item.deliveryProbability ?? 0,
  getDeadlines: (item, _logger: Logger) => ({
    deadline: item.deliveryPeriod || 1,
    deadLineMax: item.deliveryPeriodMax || item.deliveryPeriod || 1,
  }),
};

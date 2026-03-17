import { Logger } from 'winston';
import { AbcpMapperConfig } from '../../platforms/abcp/abcpResponseMapper.js';
import { calculateNpnDeadlineHours } from './calculateNpnDeadline.js';

/** Конфигурация маппера для поставщика NPN */
export const npnConfig: AbcpMapperConfig = {
  getWarehouse: (item) =>
    item.deadlineReplace === ''
      ? 'СВОЙ СКЛАД'
      : `ЧУЖОЙ СКЛАД ${item.deadlineReplace}`,
  getProbability: (item) =>
    item.deliveryProbability > 0 ? item.deliveryProbability : 95,
  getDeadlines: (item, logger: Logger) =>
    calculateNpnDeadlineHours(item, logger),
};

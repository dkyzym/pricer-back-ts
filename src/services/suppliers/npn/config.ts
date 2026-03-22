import { Logger } from 'winston';
import { AbcpMapperConfig } from '../../platforms/abcp/abcpResponseMapper.js';
import { calculateNpnDeadlineHours } from './calculateNpnDeadline.js';
import { getNpnWarehouseLabel } from './npnWarehouse.js';

/** Конфигурация маппера для поставщика NPN */
export const npnConfig: AbcpMapperConfig = {
  getWarehouse: (item) => getNpnWarehouseLabel(item),
  getProbability: (item) =>
    item.deliveryProbability > 0 ? item.deliveryProbability : 95,
  getDeadlines: (item, logger: Logger) =>
    calculateNpnDeadlineHours(item, logger),
};

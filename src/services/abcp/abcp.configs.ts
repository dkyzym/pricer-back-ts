import { Logger } from 'winston';
import { calculateNpnDeadlineHours } from '../../utils/npn/calculateNpnDeadline.js';
import { AbcpMapperConfig } from './abcpResponseMapper.js';

// Конфигурация для 'ug', 'ug_f', 'ug_bn'
export const ugConfig: AbcpMapperConfig = {
    getWarehouse: (item) => item.supplierDescription ?? '',
    getProbability: (item) => {
        const ownWarehouses = ['краснодар', 'ростов'];
        const supplierDescriptionLower = (item.supplierDescription ?? '').toLowerCase();
        return ownWarehouses.some((w) => supplierDescriptionLower.includes(w))
            ? 95
            : (item.deliveryProbability ?? 0);
    },
    // *** ИЗМЕНЕНИЕ: Добавлен параметр logger, чтобы соответствовать интерфейсу ***
    getDeadlines: (item, _logger: Logger) => ({
        deadline: item.deliveryPeriod || 1,
        deadLineMax: item.deliveryPeriodMax || item.deliveryPeriod || 1,
    }),
};

// Конфигурация для 'patriot'
export const patriotConfig: AbcpMapperConfig = {
    getWarehouse: (item) => item.supplierDescription ?? '',
    getProbability: (_item) => 95,
    // *** ИЗМЕНЕНИЕ: Добавлен параметр logger, чтобы соответствовать интерфейсу ***
    getDeadlines: (item, _logger: Logger) => ({
        deadline: item.deliveryPeriod || 24,
        deadLineMax: item.deliveryPeriodMax || item.deliveryPeriod || 24,
    }),
};

// Конфигурация для 'npn'
export const npnConfig: AbcpMapperConfig = {
    getWarehouse: (item) =>
        item.deadlineReplace === ''
            ? 'СВОЙ СКЛАД'
            : `ЧУЖОЙ СКЛАД ${item.deadlineReplace}`,
    getProbability: (item) =>
        item.deliveryProbability > 0 ? item.deliveryProbability : 95,
    // *** ИЗМЕНЕНИЕ: Теперь мы принимаем и используем настоящий logger ***
    getDeadlines: (item, logger: Logger) => calculateNpnDeadlineHours(item, logger),
};

// Конфигурация для 'avtodinamika'
export const avtodinamikaConfig: AbcpMapperConfig = {
    getWarehouse: (item) => (item.deliveryPeriod === 0 ? 'СВОЙ' : 'ЧУЖОЙ СКЛАД'),
    getProbability: (item) => item.deliveryProbability ?? 0,
    // *** ИЗМЕНЕНИЕ: Добавлен параметр logger, чтобы соответствовать интерфейсу ***
    getDeadlines: (item, _logger: Logger) => ({
        deadline: item.deliveryPeriod || 1,
        deadLineMax: item.deliveryPeriodMax || item.deliveryPeriod || 1,
    }),
};


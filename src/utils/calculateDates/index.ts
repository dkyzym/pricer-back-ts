import { logger } from 'config/logger';
import { DateTime } from 'luxon';
import { ProductProfit, SearchResultsParsed } from 'types';
import { suppliersConfig } from './suppliersConfig/suppliersConfig';

// Определяем type guard для ProductProfit
const isProductProfit = (
  result: SearchResultsParsed | ProductProfit
): result is ProductProfit => {
  return (result as ProductProfit).delivery_date !== undefined;
};

export const calculateDeliveryDate = (
  result: SearchResultsParsed | ProductProfit
): string => {
  const currentTime = DateTime.now().setZone('UTC+3');
  const supplierConfig = suppliersConfig.find(
    (config) => config.supplierName === result.supplier
  );

  if (!supplierConfig) {
    throw new Error(`Configuration for supplier ${result.supplier} not found.`);
  }

  let deliveryDate: DateTime;

  if (supplierConfig.specialConditions) {
    // Если supplierConfig требует SearchResultsParsed, то используем type guard
    if (isProductProfit(result)) {
      throw new Error(
        `Special conditions не поддерживают ProductProfit для поставщика ${result.supplier}`
      );
    }
    deliveryDate = supplierConfig.specialConditions(currentTime, result);
  } else if (isProductProfit(result) && result.delivery_date) {
    deliveryDate = DateTime.fromISO(result.delivery_date);
  } else {
    logger.error(`Неизвестные условия для поставщика ${result.supplier}`);
    throw new Error(`Неизвестные условия для поставщика ${result.supplier}`);
  }

  return deliveryDate.toFormat('yyyy-MM-dd');
};

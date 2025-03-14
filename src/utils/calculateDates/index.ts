import { logger } from 'config/logger/index.js';
import { DateTime } from 'luxon';
import { ProductProfit, SearchResultsParsed } from 'types/index.js';
import { suppliersConfig } from './suppliersConfig/suppliersConfig.js';
import { Logger } from 'winston';

// Определяем type guard для ProductProfit
const isProductProfit = (
  result: SearchResultsParsed | ProductProfit
): result is ProductProfit => {
  return (result as ProductProfit).delivery_date !== undefined;
};

export const calculateDeliveryDate = (
  result: SearchResultsParsed | ProductProfit,
  userLogger: Logger
): string => {
  const currentTime = DateTime.now().setZone('UTC+3');
  const supplierConfig = suppliersConfig.find(
    (config) => config.supplierName === result.supplier
  );

  if (!supplierConfig) {
    throw new Error(`Configuration for supplier ${result.supplier} not found.`);
  }

  let deliveryDate: DateTime | null = null;

  if (supplierConfig.specialConditions) {
    // Если supplierConfig требует SearchResultsParsed, то используем type guard
    if (isProductProfit(result)) {
      userLogger.error(
        `Special conditions не поддерживают ProductProfit для поставщика ${result.supplier}`
      );
      // Устанавливаем дату по умолчанию вместо выбрасывания ошибки
      deliveryDate = DateTime.fromISO('2999-01-01');
    } else {
      deliveryDate = supplierConfig.specialConditions(currentTime, result);
    }
  } else if (isProductProfit(result) && result.delivery_date) {
    deliveryDate = DateTime.fromISO(result.delivery_date);
  }

  if (!deliveryDate) {
    // Если deliveryDate не удалось определить, устанавливаем дату по умолчанию
    deliveryDate = DateTime.fromISO('2999-02-28');
    userLogger.warn(
      `delivery_date отсутствует для поставщика ${result.supplier}. Установлена дата по умолчанию: ${deliveryDate.toFormat(
        'yyyy-MM-dd'
      )}`
    );
  }

  if (deliveryDate.weekday === 7) {
    deliveryDate = deliveryDate.plus({ days: 1 });
  }

  return deliveryDate.toFormat('yyyy-MM-dd');
};

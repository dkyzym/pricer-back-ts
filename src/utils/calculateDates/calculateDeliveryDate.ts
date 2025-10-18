import { DateTime } from 'luxon';
import { ProductProfit, SearchResultsParsed } from 'types/index.js';
import { Logger } from 'winston';
import { runCalculationEngine } from './deliveryCalculator.js';
import { suppliersConfig } from './suppliersConfig/suppliersConfig.declarative.js';


/**
 * This is the main function your application will call to get a delivery date.
 * It acts as a simple facade over the complex calculation engine.
 *
 * @param result The product data object (either SearchResultsParsed or ProductProfit).
 * @param userLogger A logger instance.
 * @returns The calculated delivery date as a 'yyyy-MM-dd' string, or a fallback string.
 */
export const calculateDeliveryDate = (
  result: SearchResultsParsed | ProductProfit,
  userLogger: Logger
): string => {
  // 1. Get the current time for calculations.
  const currentTime = DateTime.now().setZone('UTC+3');

  // 2. Find the declarative configuration for the given supplier.
  const supplierConfig = suppliersConfig.find(
    (config) => config.supplierName === result.supplier
  );

  // 3. If no config is found, log an error and return a specific string.
  if (!supplierConfig) {
    userLogger.error(`Configuration for supplier ${result.supplier} not found.`);
    return 'NO_CONFIG';
  }

  // 4. Pass the config, data, and current time to the calculation engine.
  const deliveryDate = runCalculationEngine(
    supplierConfig,
    result,
    currentTime
  );

  // 5. Format the result or return a default if the engine couldn't calculate a date.
  if (deliveryDate) {
    return deliveryDate.toFormat('yyyy-MM-dd');
  } else {
    userLogger.warn(
      `Could not calculate delivery date for supplier ${result.supplier}. Defaulting to far future.`
    );
    return '2999-12-31';
  }
};

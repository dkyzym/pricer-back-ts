import { Logger } from 'winston';
import { UgSupplierAlias } from '../../../services/abcp/abcpPlatform.types.js';
import { fetchAbcpData } from '../../../services/abcp/api/fetchAbcpData.js';
import { mapUgResponseData } from '../../../services/ug/mapUgResponseData.js';
import { getItemResultsParams, SearchResultsParsed } from '../../../types/search.types.js';
import { createAbcpError } from '../../../utils/abcpErrorHandler.js';

// Создаем функцию-проверку (type guard)
const isUgSupplier = (
  supplier: string
): supplier is UgSupplierAlias => {
  return ['ug', 'ug_f', 'ug_bn'].includes(supplier);
};

export const handleUg = async (
  data: getItemResultsParams,
  userLogger: Logger
): Promise<SearchResultsParsed[]> => {
  const { item, supplier } = data;

  // Используем проверку
  if (!isUgSupplier(supplier)) {
    // Если сюда попал неверный поставщик, мы сразу это узнаем
    throw new Error(`Invalid supplier passed to handleUg: ${supplier}`);
  }

  try {
    const useOnlineStocks = ['ug_f', 'ug_bn'].includes(supplier) ? 0 : 1;
    const responseData = await fetchAbcpData(
      item.article,
      item.brand,
      supplier,
      useOnlineStocks
    );
    return mapUgResponseData(responseData, item.brand, userLogger, supplier);
  } catch (error) {
    throw createAbcpError(error, supplier, userLogger);
  }
};

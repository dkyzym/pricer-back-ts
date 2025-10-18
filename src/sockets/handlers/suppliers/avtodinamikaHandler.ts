import { Logger } from 'winston';
import { getItemResultsParams, SearchResultsParsed } from '../../../types/search.types.js';

import { mapAvtodinamikaResponseData } from '../../../services/avtodinamika/mapAvtodinamikaResponseData.js';
import { fetchAbcpData } from '../../../services/ug/fetchAbcpData/fetchAbcpData.js';
import { createAbcpError } from '../../../utils/abcpErrorHandler.js';

export const handleAvtodinamika = async (
  data: getItemResultsParams,
  userLogger: Logger
): Promise<SearchResultsParsed[]> => {
  const { item, supplier } = data;

  if (supplier !== 'avtodinamika') {
    throw new Error(`Invalid supplier passed to handleUg: ${supplier}`);
  }

  try {
    const useOnlineStocks = 0;

    const responseData = await fetchAbcpData(
      item.article,
      item.brand,
      supplier,
      useOnlineStocks
    );

    return mapAvtodinamikaResponseData(
      responseData,
      item.brand,
      userLogger,
      supplier
    );
  } catch (error) {
    throw createAbcpError(error, supplier, userLogger);
  }
};

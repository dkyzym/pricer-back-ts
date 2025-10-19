import { Logger } from 'winston';
import { fetchAbcpData } from '../../../services/abcp/api/fetchAbcpData.js';
import { mapNpnResponseData } from '../../../services/npn/mapNpnResponseData.js';
import { getItemResultsParams, SearchResultsParsed } from '../../../types/search.types.js';
import { createAbcpError } from '../../../utils/abcpErrorHandler.js';

export const handleNpn = async (
  data: getItemResultsParams,
  userLogger: Logger
): Promise<SearchResultsParsed[]> => {
  const { item, supplier } = data;
  if (supplier !== 'npn') {
    throw new Error(`Invalid supplier for Autosputnik handler: ${supplier}`);
  }

  try {
    const responseData = await fetchAbcpData(
      item.article,
      item.brand,
      supplier
    );
    return mapNpnResponseData(responseData, item.brand, userLogger, supplier);
  } catch (error) {
    throw createAbcpError(error, supplier, userLogger);
  }
};

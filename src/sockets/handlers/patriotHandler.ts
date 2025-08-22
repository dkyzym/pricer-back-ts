import { Logger } from 'winston';
import { mapPatriotResponseData } from '../../services/patriot/mapPatriotResponseData.js';
import { fetchAbcpData } from '../../services/ug/fetchAbcpData/fetchAbcpData.js';
import {
  getItemResultsParams,
  SearchResultsParsed,
} from '../../types/index.js';
import { createAbcpError } from '../../utils/abcpErrorHandler.js';

export const handlePatriot = async (
  data: getItemResultsParams,
  userLogger: Logger
): Promise<SearchResultsParsed[]> => {
  const { item, supplier } = data;
  if (supplier !== 'patriot') {
    throw new Error(`Invalid supplier for Autosputnik handler: ${supplier}`);
  }

  try {
    const responseData = await fetchAbcpData(
      item.article,
      item.brand,
      supplier as 'patriot'
    );
    return mapPatriotResponseData(
      responseData,
      item.brand,
      userLogger,
      supplier as 'patriot'
    );
  } catch (error) {
    throw createAbcpError(error, supplier, userLogger);
  }
};

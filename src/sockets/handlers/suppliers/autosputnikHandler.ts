import { Logger } from 'winston';
import { getItemResultsParams, SearchResultsParsed } from '../../../types/search.types.js';
import { parseAutosputnikData } from '../../../utils/data/autosputnik/parseAutosputnikData.js';

export const handleAutosputnik = async (
  data: getItemResultsParams,
  userLogger: Logger
): Promise<SearchResultsParsed[]> => {
  const { item, supplier } = data;

  if (supplier === 'autosputnik' || supplier === 'autosputnik_bn') {
    return await parseAutosputnikData(item, userLogger, supplier);
  }

  throw new Error(`Invalid supplier for Autosputnik handler: ${supplier}`);
};

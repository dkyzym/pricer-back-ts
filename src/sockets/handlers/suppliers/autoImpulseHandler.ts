import { Logger } from 'winston';
import { itemDataAutoImpulseService } from '../../../services/autoimpulse/itemDataAutoImpulseService.js';
import { getItemResultsParams, SearchResultsParsed } from '../../../types/search.types.js';

export const handleAutoImpulse = async (
  data: getItemResultsParams,
  userLogger: Logger
): Promise<SearchResultsParsed[]> => {
  return await itemDataAutoImpulseService({ ...data, userLogger });
};

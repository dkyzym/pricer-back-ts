import { Logger } from 'winston';
import { itemDataMikanoService } from '../../../services/mikano/itemDataMikanoService.js';
import { getItemResultsParams, SearchResultsParsed } from '../../../types/search.types.js';


export const handleMikano = async (
  data: getItemResultsParams,
  userLogger: Logger
): Promise<SearchResultsParsed[]> => {
  return await itemDataMikanoService({ ...data, userLogger });
};

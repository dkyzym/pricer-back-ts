import { Logger } from 'winston';
import { itemDataMikanoService } from '../../../services/mikano/itemDataAutoMikanoService.js';
import {
  getItemResultsParams,
  SearchResultsParsed,
} from '../../../types/index.js';

export const handleMikano = async (
  data: getItemResultsParams,
  userLogger: Logger
): Promise<SearchResultsParsed[]> => {
  return await itemDataMikanoService({ ...data, userLogger });
};

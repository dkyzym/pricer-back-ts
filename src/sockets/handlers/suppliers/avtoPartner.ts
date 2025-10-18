import { Logger } from 'winston';
import { itemDataAvtoPartnerService } from '../../../services/avtopartner/itemDataAvtoPartnerService.js';
import { getItemResultsParams, SearchResultsParsed } from '../../../types/search.types.js';


export const handleAvtoPartner = async (
  data: getItemResultsParams,
  userLogger: Logger
): Promise<SearchResultsParsed[]> => {
  return await itemDataAvtoPartnerService({ ...data, userLogger });
};

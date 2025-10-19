import { Logger } from 'winston';
import { AbcpArticleSearchResult } from '../../types/abcpPlatform.types.js';
import { SearchResultsParsed } from '../../types/search.types.js';
import { npnConfig } from '../abcp/abcp.configs.js';
import { mapAbcpResponse } from '../abcp/abcpResponseMapper.js';

export const mapNpnResponseData = (
  data: AbcpArticleSearchResult[],
  brand: string,
  userLogger: Logger,
  supplier: 'npn'
): SearchResultsParsed[] => {
  return mapAbcpResponse(data, brand, userLogger, supplier, npnConfig);
};
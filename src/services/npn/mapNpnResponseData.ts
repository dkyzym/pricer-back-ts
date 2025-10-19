import { Logger } from 'winston';
import { SearchResultsParsed } from '../../types/search.types.js';
import { npnConfig } from '../abcp/abcp.configs.js';
import { AbcpArticleSearchResult } from '../abcp/abcpPlatform.types.js';
import { mapAbcpResponse } from '../abcp/abcpResponseMapper.js';

export const mapNpnResponseData = (
  data: AbcpArticleSearchResult[],
  brand: string,
  userLogger: Logger,
  supplier: 'npn'
): SearchResultsParsed[] => {
  return mapAbcpResponse(data, brand, userLogger, supplier, npnConfig);
};
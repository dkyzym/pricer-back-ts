import { Logger } from 'winston';
import { SearchResultsParsed } from '../../types/search.types.js';
import { patriotConfig } from '../abcp/abcp.configs.js';
import { AbcpArticleSearchResult } from '../abcp/abcpPlatform.types.js';
import { mapAbcpResponse } from '../abcp/abcpResponseMapper.js';

export const mapPatriotResponseData = (
  data: AbcpArticleSearchResult[],
  brand: string,
  userLogger: Logger,
  supplier: 'patriot'
): SearchResultsParsed[] => {
  return mapAbcpResponse(data, brand, userLogger, supplier, patriotConfig);
};
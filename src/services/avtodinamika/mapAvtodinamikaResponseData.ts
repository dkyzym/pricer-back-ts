import { Logger } from 'winston';
import { SearchResultsParsed } from '../../types/search.types.js';
import { avtodinamikaConfig } from '../abcp/abcp.configs.js';
import { AbcpArticleSearchResult } from '../abcp/abcpPlatform.types.js';
import { mapAbcpResponse } from '../abcp/abcpResponseMapper.js';

export const mapAvtodinamikaResponseData = (
  data: AbcpArticleSearchResult[],
  brand: string,
  userLogger: Logger,
  supplier: 'avtodinamika'
): SearchResultsParsed[] => {
  return mapAbcpResponse(data, brand, userLogger, supplier, avtodinamikaConfig);
};
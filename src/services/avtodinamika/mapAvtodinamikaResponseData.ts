import { Logger } from 'winston';
import { AbcpArticleSearchResult } from '../../types/abcpPlatform.types.js';
import { SearchResultsParsed } from '../../types/search.types.js';
import { avtodinamikaConfig } from '../abcp/abcp.configs.js';
import { mapAbcpResponse } from '../abcp/abcpResponseMapper.js';

export const mapAvtodinamikaResponseData = (
  data: AbcpArticleSearchResult[],
  brand: string,
  userLogger: Logger,
  supplier: 'avtodinamika'
): SearchResultsParsed[] => {
  return mapAbcpResponse(data, brand, userLogger, supplier, avtodinamikaConfig);
};
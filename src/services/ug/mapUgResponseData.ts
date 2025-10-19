import { Logger } from 'winston';
import { AbcpArticleSearchResult, UgSupplierAlias } from '../../types/abcpPlatform.types.js';
import { SearchResultsParsed } from '../../types/search.types.js';
import { ugConfig } from '../abcp/abcp.configs.js';
import { mapAbcpResponse } from '../abcp/abcpResponseMapper.js';

export const mapUgResponseData = (
  data: AbcpArticleSearchResult[],
  brand: string,
  userLogger: Logger,
  supplier: UgSupplierAlias
): SearchResultsParsed[] => {
  return mapAbcpResponse(data, brand, userLogger, supplier, ugConfig);
};
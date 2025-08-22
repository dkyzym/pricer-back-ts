import { Logger } from 'winston';
import { searchTurbocarsCode } from '../../services/turboCars/searchTurboCarsCode.js';
import {
  getItemResultsParams,
  SearchResultsParsed,
} from '../../types/index.js';
import { parseXmlToSearchResults } from '../../utils/mapData/mapTurboCarsData.js';

export const handleTurboCars = async (
  data: getItemResultsParams,
  userLogger: Logger
): Promise<SearchResultsParsed[]> => {
  const { item } = data;
  const withAnalogs = 0;
  const codeSearchResult = await searchTurbocarsCode(item.article);
  return parseXmlToSearchResults(
    codeSearchResult,
    item.brand,
    withAnalogs,
    userLogger
  );
};

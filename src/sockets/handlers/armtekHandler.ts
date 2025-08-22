import { Logger } from 'winston';
import { parseArmtekResults } from '../../services/armtek/parseArmtekResults.js';
import { searchArmtekArticle } from '../../services/armtek/searchArmtekArticle.js';
import { getCachedStoreList } from '../../services/armtek/storeList.js';
import {
  getItemResultsParams,
  SearchResultsParsed,
} from '../../types/index.js';
import { isRelevantBrand } from '../../utils/isRelevantBrand.js';

export const handleArmtek = async (
  data: getItemResultsParams,
  userLogger: Logger
): Promise<SearchResultsParsed[]> => {
  const { item } = data;
  const { RESP, STATUS, MESSAGES } = await searchArmtekArticle(
    { PIN: item.article },
    userLogger
  );

  if (!RESP || !RESP.length) {
    userLogger.warn(
      `Armtek returned no results: ${JSON.stringify({ STATUS, MESSAGES })}`
    );
    return [];
  }

  const relevantItems = RESP.filter((resItem) =>
    isRelevantBrand(item.brand, resItem.BRAND || '')
  );
  const storeList = await getCachedStoreList();
  return parseArmtekResults(relevantItems, storeList);
};

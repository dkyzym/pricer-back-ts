import { getItemsListByArticleService } from 'services/profit/getItemsListByArticleService.js';
import { getItemsWithRest } from 'services/profit/getItemsWithRest.js';
import { parseProfitApiResponse } from 'utils/data/profit/parseProfitApiResponse.js';
import { Logger } from 'winston';

import { isRelevantBrand } from '../../../utils/data/brand/isRelevantBrand.js';
import { getItemResultsParams, SearchResultsParsed } from '../../../types/search.types.js';
import { ItemsGroupProfit } from '../../../services/profit/profit.types.js';

export const handleProfit = async (
  data: getItemResultsParams,
  userLogger: Logger
): Promise<SearchResultsParsed[]> => {
  const { item } = data;
  const items: ItemsGroupProfit = await getItemsListByArticleService(
    item.article
  );
  const itemsWithRest = await getItemsWithRest(items, userLogger);
  const relevantItems = itemsWithRest.filter(({ brand }: any) =>
    isRelevantBrand(item.brand, brand)
  );
  return parseProfitApiResponse(relevantItems, item.brand, userLogger);
};

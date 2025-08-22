import { getItemsListByArticleService } from 'services/profit/getItemsListByArticleService.js';
import { getItemsWithRest } from 'services/profit/getItemsWithRest.js';
import { parseProfitApiResponse } from 'utils/data/profit/parseProfitApiResponse.js';
import { Logger } from 'winston';
import {
  getItemResultsParams,
  itemsGroupProfit,
  SearchResultsParsed,
} from '../../../types/index.js';
import { isRelevantBrand } from '../../../utils/isRelevantBrand.js';

export const handleProfit = async (
  data: getItemResultsParams,
  userLogger: Logger
): Promise<SearchResultsParsed[]> => {
  const { item } = data;
  const items: itemsGroupProfit = await getItemsListByArticleService(
    item.article
  );
  const itemsWithRest = await getItemsWithRest(items, userLogger);
  const relevantItems = itemsWithRest.filter(({ brand }: any) =>
    isRelevantBrand(item.brand, brand)
  );
  return parseProfitApiResponse(relevantItems, item.brand, userLogger);
};

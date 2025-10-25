import {
  ItemToParallelSearch,
  SearchResultsParsed,
} from '../../types/search.types.js';
import { standardizeString } from './brand/standardizeString.js';

export const filterEqualResults = (
  results: SearchResultsParsed[],
  item: ItemToParallelSearch
) => {
  return results.filter((result) => {
    const sameArticle =
      standardizeString(result.article) === standardizeString(item.article);
    const sameBrand =
      standardizeString(result.brand) === standardizeString(item.brand);
    return sameBrand && sameArticle;
  });
};

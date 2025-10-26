import {
  ItemToParallelSearch,
  SearchResultsParsed,
} from '../../types/search.types.js';
import { standardizeString } from './brand/standardizeString.js';

export const filterEqualResults = (
  results: SearchResultsParsed[],
  originalItem: ItemToParallelSearch,
  articleSearched: string
): SearchResultsParsed[] => {
  const standardizedArticleSearched = standardizeString(articleSearched);

  const standardizedOriginalBrand = standardizeString(originalItem.brand);

  return results.filter((result) => {
    const sameBrand =
      standardizeString(result.brand) === standardizedOriginalBrand;

    const sameArticle =
      standardizeString(result.article) === standardizedArticleSearched;

    return sameBrand && sameArticle;
  });
};

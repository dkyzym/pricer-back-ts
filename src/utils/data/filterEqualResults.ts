// import { ItemToParallelSearch, SearchResultsParsed } from 'types/index.js';
import { ItemToParallelSearch, SearchResultsParsed } from '../../types/search.types.js';
import { formatText } from './formatText.js';

export const filterEqualResults = (
  results: SearchResultsParsed[],
  item: ItemToParallelSearch
) => {
  return results.filter((result) => {
    const sameArticle = formatText(result.article) === formatText(item.article);
    const sameBrand = formatText(result.brand) === formatText(item.brand);
    return sameBrand && sameArticle;
  });
};

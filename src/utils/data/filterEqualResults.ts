import { SearchResult, SearchResultsWithRestUg } from '../../types';
import { formatText } from './formatText';

export const filterEqualResults = (
  results: SearchResultsWithRestUg[],
  item: SearchResult
) => {
  return results.filter((result) => {
    const sameArticle = formatText(result.article) === formatText(item.article);
    const sameBrand = formatText(result.brand) === formatText(item.brand);
    return sameBrand && sameArticle;
  });
};
import { Page } from 'puppeteer';
import { ItemToParallelSearch } from 'types';
import { formatText } from '../data/formatText';

const parseFirstRow = async (
  page: Page
): Promise<{ extractedBrand: string; extractedArticle: string }> => {
  return page.evaluate(() => {
    const firstRow = document.querySelector('.startSearching') as HTMLElement;

    if (!firstRow) {
      return { extractedBrand: '', extractedArticle: '' };
    }

    const extractedBrandEl = firstRow.querySelector('.caseBrand');
    const extractedArticleEl = firstRow.querySelector('.casePartCode');

    const extractedBrand = extractedBrandEl?.textContent?.trim() || '';
    const extractedArticle = extractedArticleEl?.textContent?.trim() || '';

    return { extractedBrand, extractedArticle };
  });
};

export const isInStockPatriot = async (
  page: Page,
  item: ItemToParallelSearch
): Promise<boolean> => {
  const { extractedBrand, extractedArticle } = await parseFirstRow(page);

  if (!extractedBrand || !extractedArticle) {
    return false;
  }

  const formattedExtractedBrand = formatText(extractedBrand);
  const formattedExtractedArticle = formatText(extractedArticle);
  const formattedArticle = formatText(item.article);
  const formattedBrand = formatText(item.brand);

  return (
    formattedExtractedBrand === formattedBrand &&
    formattedExtractedArticle === formattedArticle
  );
};

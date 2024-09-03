import { Page } from 'puppeteer';
import { SearchResult, SearchResultsWithRestUg, SupplierName } from 'types';
import { v4 as uuidv4 } from 'uuid';
import { filterEqualResults } from '../data/filterEqualResults';

export const parseData = async (
  page: Page
): Promise<Omit<SearchResultsWithRestUg, 'id' | 'supplier'>[]> => {
  return await page.evaluate(() => {
    const rows = document.querySelectorAll('[class^="resultTr2"]');
    const data: Omit<SearchResultsWithRestUg, 'id' | 'supplier'>[] = [];

    rows.forEach((row) => {
      const product: Omit<SearchResultsWithRestUg, 'id' | 'supplier'> = {
        article:
          (
            row.querySelector('.resultPartCode a') as HTMLElement
          )?.innerText.trim() || '',
        brand:
          (
            row.querySelector('.resultBrand a') as HTMLElement
          )?.innerText.trim() || '',
        description:
          (
            row.querySelector('.resultDescription a') as HTMLElement
          )?.innerText.trim() || '',
        availability:
          parseInt(row.getAttribute('data-availability') || '0', 10) || 0,
        price: parseFloat(row.getAttribute('data-output-price') || '0') || 0,
        warehouse:
          (
            row.querySelector('.resultWarehouse') as HTMLElement
          )?.innerText.trim() || '',
        imageUrl:
          row.querySelector('.resultImage img')?.getAttribute('src') || '',
        deadline: parseInt(row.getAttribute('data-deadline') || '0') || 0,
        deadLineMax:
          parseInt(row.getAttribute('data-deadline-max') || '0') || 0,
        probability:
          parseFloat(
            row
              .querySelector('.resultProbability')
              ?.textContent?.replace('%', '')
              .trim() || '0'
          ) || '',
      };

      data.push(product);
    });

    return data;
  });
};

export const parsePickedUgResults = async (
  page: Page,
  item: SearchResult,
  supplier: SupplierName
): Promise<SearchResultsWithRestUg[]> => {
  const allResults: SearchResultsWithRestUg[] = [];
  let allDataCollected = false;

  while (!allDataCollected) {
    const currentData = await parseData(page);

    const newData = currentData.filter(
      (current) =>
        !allResults.some(
          (prev) =>
            prev.article === current.article && prev.brand === current.brand
        )
    );

    if (newData.length > 0) {
      const resultsWithIdAndSupplier = newData.map((product) => ({
        ...product,
        id: uuidv4(),
        supplier: supplier,
      }));

      const filteredResults = filterEqualResults(
        resultsWithIdAndSupplier,
        item
      );

      allResults.push(...filteredResults);
    }

    allDataCollected = await page.evaluate(() => {
      const progressBar = document.getElementById('searchInProgress');
      return !progressBar;
    });

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return allResults;
};

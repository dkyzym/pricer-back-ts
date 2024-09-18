import { Page } from 'puppeteer';
import { ParallelSearchParams, SearchResultsWithRestUg } from 'types';
import { filterEqualResults } from '../data/filterEqualResults';

export const parseData = async (
  page: Page
): Promise<Omit<SearchResultsWithRestUg, 'supplier'>[]> => {
  return await page.evaluate(() => {
    const rows = document.querySelectorAll('[class^="resultTr2"]');
    const data: Omit<SearchResultsWithRestUg, 'supplier'>[] = [];

    rows.forEach((row) => {
      const product: Omit<SearchResultsWithRestUg, 'supplier'> = {
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
            row.querySelector('.resultDescription') as HTMLElement
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
        id:
          row
            .querySelector('input.quantityInputFake')
            ?.getAttribute('searchresultuniqueid') || '',
      };

      data.push(product);
    });

    return data;
  });
};

export const parsePickedUgResults = async ({
  page,
  item,
  supplier,
}: ParallelSearchParams): Promise<SearchResultsWithRestUg[]> => {
  const allResults: SearchResultsWithRestUg[] = [];

  await page.waitForSelector('#searchInProgress', {
    hidden: true,
    timeout: 60000,
  });

  await new Promise((resolve) => setTimeout(resolve, 1000));

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
      supplier: supplier,
    }));

    const filteredResults = filterEqualResults(resultsWithIdAndSupplier, item);

    allResults.push(...filteredResults);
  }

  return allResults;
};

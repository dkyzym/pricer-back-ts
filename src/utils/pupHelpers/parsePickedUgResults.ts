import { Page } from 'puppeteer';
import { SearchResult, SearchResultsWithRestUg, SupplierName } from 'types';
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

// export const parsePickedUgResults = async (
//   page: Page,
//   item: SearchResult,
//   supplier: SupplierName
// ): Promise<SearchResultsWithRestUg[]> => {
//   const allResults: SearchResultsWithRestUg[] = [];
//   let allDataCollected = false;

//   while (!allDataCollected) {
//     const currentData = await parseData(page);

//     const newData = currentData.filter(
//       (current) =>
//         !allResults.some(
//           (prev) =>
//             prev.article === current.article && prev.brand === current.brand
//         )
//     );

//     if (newData.length > 0) {
//       const resultsWithIdAndSupplier = newData.map((product) => ({
//         ...product,

//         supplier: supplier,
//       }));

//       const filteredResults = filterEqualResults(
//         resultsWithIdAndSupplier,
//         item
//       );

//       allResults.push(...filteredResults);
//     }

//     allDataCollected = await page.evaluate(() => {
//       const progressBar = document.getElementById('searchInProgress');
//       return !progressBar;
//     });

//     if (allDataCollected) {
//       await new Promise((resolve) => setTimeout(resolve, 2000));
//       // allDataCollected = await page.evaluate(() => {
//       //   const progressBar = document.getElementById('searchInProgress');
//       //   return !progressBar;
//       // });
//     }

//     await new Promise((resolve) => setTimeout(resolve, 1500));
//   }

//   return allResults;
// };

export const parsePickedUgResults = async (
  page: Page,
  item: SearchResult,
  supplier: SupplierName
): Promise<SearchResultsWithRestUg[]> => {
  const allResults: SearchResultsWithRestUg[] = [];

  await page.waitForNetworkIdle({ idleTime: 1750, timeout: 60000 });

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

// https://ugautopart.ru/search/MANN-FILTER/W81180?action=getAsyncSearchResults&searchBrand=MANN-FILTER&searchNumber=W81180&resellerId=3993538&customerIdForSearch=9447854&customerIdForPrice=9447854&enc=&selectLinkName=price&selectSortDirection=0&withOutAnalogs=0&asyncKey=zgtSvAn%2F9lSM1Jfzr3ZpG9NzU1%2B6uLX40NY37grJXKXksONJpfz%2BV4igpFm5KrtQjWNcfo47T5mTmWWuG%2FfUg9LtplKVlTFv%2BzYxY1WzuFAeZJ4x129%2FPMu97%2F800pyoVh9oIXya4UXhfJjKTu3UtTyKmIyTe7Wbp3ujbNQdsmIlzUl1psSm5h1ZUgCLg85tH7sqK%2FlwnpoxHr1HGdbD5A%3D%3D&currentUrl=%2Fsearch%2FMANN-FILTER%2FW81180

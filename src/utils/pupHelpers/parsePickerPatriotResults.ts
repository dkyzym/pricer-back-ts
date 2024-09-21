import {
  ItemToParallelSearch,
  ParallelSearchParams,
  SearchResultsParsed,
} from 'types';

export const parsePickedPatriotResults = async ({
  page,
  item,
  supplier,
}: ParallelSearchParams): Promise<SearchResultsParsed[]> => {
  try {
    await page.waitForNetworkIdle();
    return await page.evaluate((item: ItemToParallelSearch) => {
      console.log('item:', item.article);
      const firstRow = document.querySelector(
        `[data-current-brand-number*="${item.article.toUpperCase()}"]`
      );
      console.log(firstRow);

      if (!firstRow) {
        return [];
      }

      // Парсинг данных
      return [];
    }, item);
  } catch (error) {
    console.error(`Error in parsePickedPatriotResults: ${error}`);
    return [];
  }
};

// const rows = document.querySelectorAll('[class^="resultTr2"]');
// const data: Omit<SearchResultsParsed, 'supplier'>[] = [];

// rows.forEach((row) => {
//   const product: Omit<SearchResultsParsed, 'supplier'> = {
//     article:
//       (
//         row.querySelector('.resultPartCode a') as HTMLElement
//       )?.innerText.trim() || '',
//     brand:
//       (
//         row.querySelector('.resultBrand a') as HTMLElement
//       )?.innerText.trim() || '',
//     description:
//       (
//         row.querySelector('.resultDescription') as HTMLElement
//       )?.innerText.trim() || '',
//     availability:
//       parseInt(row.getAttribute('data-availability') || '0', 10) || 0,
//     price: parseFloat(row.getAttribute('data-output-price') || '0') || 0,
//     warehouse:
//       (
//         row.querySelector('.resultWarehouse') as HTMLElement
//       )?.innerText.trim() || '',
//     imageUrl:
//       row.querySelector('.resultImage img')?.getAttribute('src') || '',
//     deadline: parseInt(row.getAttribute('data-deadline') || '0') || 0,
//     deadLineMax:
//       parseInt(row.getAttribute('data-deadline-max') || '0') || 0,
//     probability:
//       parseFloat(
//         row
//           .querySelector('.resultProbability')
//           ?.textContent?.replace('%', '')
//           .trim() || '0'
//       ) || '',
//     id:
//       row
//         .querySelector('input.quantityInputFake')
//         ?.getAttribute('searchresultuniqueid') || '',
//   };

//   data.push(product);
// });

// return [data];

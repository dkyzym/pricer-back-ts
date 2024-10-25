import { Page } from 'puppeteer';
import { ParallelSearchParams, SearchResultsParsed } from 'types';
import { calculateDeliveryDate } from '../calculateDates';
import { filterEqualResults } from '../data/filterEqualResults';

export const parseData = async (
  page: Page
): Promise<Omit<SearchResultsParsed, 'supplier'>[]> => {
  return await page.evaluate(() => {
    const rows = document.querySelectorAll('[class^="resultTr2"]');
    const data: Omit<SearchResultsParsed, 'supplier'>[] = [];

    rows.forEach((row) => {
      const product: Omit<SearchResultsParsed, 'supplier'> = {
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
        multi: Number(
          row
            .querySelector('input.addToBasketLinkFake')
            ?.getAttribute('packing') || '1'
        ),
        allow_return: row
          .querySelector('.fr-icon2-minus-circled.fr-text-danger')
          ?.getAttribute('title')
          ?.includes('не подлежит возврату или обмену')
          ? '0'
          : '1',
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
}: ParallelSearchParams): Promise<SearchResultsParsed[]> => {
  const allResults: SearchResultsParsed[] = [];

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
      supplier,
    }));

    const filteredResults = filterEqualResults(resultsWithIdAndSupplier, item);

    const resultsWithDeliveryDate = filteredResults.map((result) => {
      const deliveryDate = calculateDeliveryDate(result);
      return {
        ...result,
        deliveryDate,
      };
    });

    allResults.push(...resultsWithDeliveryDate);
  }

  return allResults;
};

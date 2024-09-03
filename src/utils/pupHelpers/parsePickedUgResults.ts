import { Page } from 'puppeteer';
import { v4 as uuidv4 } from 'uuid';
import {
  SearchResult,
  SearchResultsWithRestUg,
  SupplierName,
} from '../../types';
import { filterEqualResults } from '../data/filterEqualResults';

export const parseData = async (
  page: Page,
  supplier: SupplierName
): Promise<Omit<SearchResultsWithRestUg, 'id' | 'supplier'>[]> => {
  return await page.evaluate(() => {
    const rows = document.querySelectorAll('.resultTr2');
    const data: Omit<SearchResultsWithRestUg, 'id' | 'supplier'>[] = [];

    rows.forEach((row) => {
      const cells = row.querySelectorAll('td');
      const product: Omit<SearchResultsWithRestUg, 'id' | 'supplier'> = {
        article: cells[3]?.innerText.trim() || '',
        brand: cells[2]?.querySelector('a')?.innerText.trim() || '',
        description: cells[4]?.innerText.trim() || '',
        availability: parseInt(
          row.getAttribute('data-availability') || '0',
          10
        ),
        price: parseFloat(row.getAttribute('data-output-price') || '0'),
        warehouse: cells[7]?.innerText.trim() || '',
        imageUrl:
          row.querySelector('.resultImage img')?.getAttribute('src') || '',
        deadline: cells[8]?.innerText.trim() || '',
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
    const currentData = await parseData(page, supplier);

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

      // Добавляем новые результаты в общую коллекцию
      allResults.push(...filteredResults);
    }

    // Проверяем, закончилась ли загрузка данных
    allDataCollected = await page.evaluate(() => {
      const progressBar = document.getElementById('searchInProgress');
      return !progressBar; // Если элемент индикатора отсутствует, загрузка завершена
    });

    // Даем паузу перед следующей проверкой
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return allResults;
};

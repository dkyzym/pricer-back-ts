import { Page } from 'puppeteer';
import {
  ItemToParallelSearch,
  ParallelSearchParams,
  SearchResultsParsed,
} from 'types';
import { v4 as uuidv4 } from 'uuid';
import { needToCheckBrand } from '../data/needToCheckBrand';

export const isInStock = async (page: Page, item: ItemToParallelSearch) => {
  const height: number = await page.evaluate(() => {
    const el = document.querySelector('#block0');
    if (el) {
      const rect = el.getBoundingClientRect();
      return rect.height;
    }
    return 0;
  });

  return !!height;
};

export const parsePickedTurboCarsResults = async ({
  page,
  item,
  supplier,
}: ParallelSearchParams): Promise<SearchResultsParsed[]> => {
  await page.waitForSelector('#codeinfo', { visible: true });

  const { description, brand } = await page.$eval(
    '#codeinfo tbody',
    (tbody: HTMLTableSectionElement) => {
      if (!tbody) {
        throw new Error('Элемент #codeinfo tbody не найден.');
      }

      const rows = tbody.querySelectorAll('tr');
      const rowsMap = {
        description: rows[6],
        brand: rows[7],
      };

      const description =
        rowsMap.description.lastChild?.textContent?.trim() || '';

      const brand = rowsMap.brand.lastChild?.textContent?.trim() || '';

      return { description, brand };
    }
  );

  const results = await page.$$eval(
    'table.noborder.ss tr.aaa',
    (rows: HTMLTableRowElement[], brand: string) => {
      return rows
        .map((row) => {
          try {
            const tds = row.querySelectorAll('td');

            if (tds.length < 2) return null;

            const firstTdText = tds[0].innerText.trim();
            const [warehouseRaw, ...deadlineParts] = firstTdText.split(' ');
            const warehouse = warehouseRaw;
            let deadline = 4;

            const deadlineText = deadlineParts.join(' ');
            const deadlineMatch = deadlineText.match(/(\d+)\s*дн\./);
            if (deadlineMatch) {
              const days = parseInt(deadlineMatch[1], 10);
              deadline = days * 24;
            }

            const secondTdHtml = tds[1].innerHTML;
            const availabilityMatch = secondTdHtml.match(/<b>(.*?)<\/b>/);
            let availability = '';
            if (availabilityMatch) {
              availability = availabilityMatch[1]
                .replace(/шт\./, '')
                .replace(/&gt;/g, '>')
                .replace(/&lt;/g, '<')
                .trim();
            }

            let price = 0;
            const priceSpan = document.querySelector('#mypricespan b');
            if (priceSpan && priceSpan.textContent) {
              const priceText = priceSpan.textContent.trim();
              price = parseFloat(
                priceText.replace(/[^\d.,]/g, '').replace(',', '.')
              );
            }

            return {
              id: '',
              article: '',
              brand,
              description: '',
              availability,
              price,
              warehouse,
              imageUrl: '',
              deadline,
              deadLineMax: deadline,
              supplier: '',
              probability: 99.9,
              needToCheckBrand: false,
            };
          } catch (error) {
            console.error(`Ошибка при обработке строки: ${error}`);
            return null;
          }
        })
        .filter((item) => item !== null);
    },
    brand
  );

  const allResults: SearchResultsParsed[] = results.map(
    (result: SearchResultsParsed) => {
      const needToCheckBrandResult = needToCheckBrand(item.brand, result.brand);

      return {
        ...result,
        id: uuidv4(),
        article: item.article,
        supplier,
        description,
        needToCheckBrand: needToCheckBrandResult,
      };
    }
  );

  return allResults;
};

//   page.on('console', (msg) => {    // так можно логировать данные внутри eval
//     if (msg.type() === 'log') {
//       console.log(`Лог из браузера: ${msg.text()}`);
//     }
//   });

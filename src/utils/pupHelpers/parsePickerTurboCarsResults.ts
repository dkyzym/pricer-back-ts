import { Page } from 'puppeteer';
import {
  ItemToParallelSearch,
  ParallelSearchParams,
  SearchResultsParsed,
} from 'types';
import { v4 as uuidv4 } from 'uuid';
import { formatText } from '../data/formatText';
import { removePrefix } from '../data/removePrefix';

const parseFirstRow = async (page: Page) => {
  return page.evaluate(() => {
    const firstRow = document.querySelector('#block0');

    const link = firstRow?.querySelector('a[href^="galleyp.asp?"]');

    if (!link) {
      return null;
    }

    const linkText = link.textContent?.trim();

    if (!linkText) {
      return null;
    }

    return linkText;
  });
};

export const isInStock = async (page: Page, item: ItemToParallelSearch) => {
  const linkText = await parseFirstRow(page);

  if (!linkText) {
    return false;
  }

  const formattedLinkText = formatText(removePrefix(linkText));
  const formattedItemArticle = formatText(item.article);

  return formattedLinkText === formattedItemArticle;
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
      const needToCheckBrand =
        formatText(item.brand) !== formatText(result.brand);

      return {
        ...result,
        id: uuidv4(),
        article: item.article,
        supplier,
        description,
        needToCheckBrand,
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

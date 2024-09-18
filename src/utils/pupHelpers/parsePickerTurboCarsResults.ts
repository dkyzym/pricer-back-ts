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

// export const parsePickedTurboCarsResults = async ({
//   page,
//   item,
//   supplier,
// }: ParallelSearchParams): Promise<any[]> => {
//   const allResults: any[] = [];
//   {
//     /* внутри table c class="noborder ss"
//      * строка tr class="aaa"
//       в этой строке текст контент первого td нужно извлечь warehouse и (deadline = deadLineMax).
//       пример <td>РД-2 1дн. (при заказе до 21:00 МСК)</td> склад тут РД-2 (то-есть до первого пробела),
//        сроки 1дн пересчитываем в часы  - 24 часа.
//       если значения с днями нет, тогда срок 4 часа.
//      * вторая часть строки второй td.
//        внутри него из текст контента тега <b> нужно извлечь количество.
//        пример <b>&gt;10 шт.</b> тут нужно извлечь availability знак больше, если он есть, вместе с числом, шт. не нужны.

// ниже интерфейс, обьекты какого вида мы хотим собирать.
// export interface SearchResultsParsed {
//   id: string; - сгенерировать через uuid4, он установлен.
//   article: string; - item.article
//   brand: string; - извлечь текст контент из ссылки у которой в onclick есть слово "Поставщик"
//   description: string; - текст контент td у которого текст контент соседнего td "Наименование"
//   availability: number | string; - где взять обсудили выше
//   price: number; - текст контент тега <b> из span id="mypricespan", пример <b>307.20р</b>, нужно только число.
//   warehouse: string; - где взять писал выше.
//   imageUrl: string; - пустая строка.
//   deadline: number; - писал выше, дедлайны равны.
//   deadLineMax: number; - писал выше, дедлайны равны.
//   supplier: SupplierName; - supplier
//   probability: number | ''; - всюду 99.9
//   needToCheckBrand?: boolean; если item.brand пропущенный через существующую функцию formatText
//   (которая оставляет только буквы в нижнем регистре без пробелов) не равно названию бренда который мы извлекли,
//   тогда присваиваем тру
// }
//   * каждая строка tr class="aaa" это отдельный SearchResultsParsed, , возвращаем из функции SearchResultsParsed[]
//      */
//   }
//   return allResults;
// };

// export const parsePickedTurboCarsResults = async ({
//   page,
//   item,
//   supplier,
// }: ParallelSearchParams): Promise<SearchResultsParsed[]> => {
//   console.log('start parsing');
//   const allResults: SearchResultsParsed[] = [];

//   const rows = await page.$$('table.noborder.ss tbody tr.aaa');
//   console.log('rows: ' + rows?.length);
//   for (const row of rows) {
//     console.log('Начало обработки строки');

//     try {
//       const tds = await row.$$eval('td', (elements: HTMLTableCellElement[]) =>
//         elements.map((td) => td.innerText.trim())
//       );
//       console.log('tds: ' + tds?.length);
//       if (tds.length < 2) {
//         continue;
//       }

//       const firstTdText = tds[0];
//       const [warehouseRaw, ...deadlineParts] = firstTdText.split(' ');
//       const warehouse = warehouseRaw;
//       let deadline = 4;

//       const deadlineText = deadlineParts.join(' ');
//       const deadlineMatch = deadlineText.match(/(\d+)\s*дн\./);
//       if (deadlineMatch) {
//         const days = parseInt(deadlineMatch[1], 10);
//         deadline = days * 24;
//       }

//       const secondTdHtml = await row.$eval(
//         'td:nth-child(2)',
//         (td: HTMLTableCellElement) => td.innerHTML
//       );
//       const availabilityMatch = secondTdHtml.match(/<b>(.*?)<\/b>/);
//       let availability = '';
//       if (availabilityMatch) {
//         availability = availabilityMatch[1].replace(/шт\./, '').trim();
//       }

//       const brand = await page.$eval(
//         'a[onclick*="Поставщик"]',
//         (anchor: HTMLAnchorElement) => anchor.textContent?.trim() || ''
//       );

//       const description = await page.$$eval(
//         'td',
//         (elements: HTMLTableCellElement[]) => {
//           let result = '';
//           elements.forEach((td, index) => {
//             if (td.textContent?.trim() === 'Наименование') {
//               const nextTd = elements[index + 1];
//               if (nextTd) {
//                 result = nextTd.textContent?.trim() || '';
//               }
//             }
//           });
//           return result;
//         }
//       );

//       const priceText = await page.$eval(
//         '#mypricespan b',
//         (b: HTMLSpanElement) => b.textContent?.trim() || ''
//       );
//       const price = parseFloat(
//         priceText.replace(/[^\d.,]/g, '').replace(',', '.')
//       );

//       const formattedItemBrand = formatText(item?.brand);
//       const formattedExtractedBrand = formatText(brand);
//       const needToCheckBrand = formattedItemBrand !== formattedExtractedBrand;

//       const resultItem: SearchResultsParsed = {
//         id: uuidv4(),
//         article: item.article,
//         brand,
//         description,
//         availability,
//         price,
//         warehouse,
//         imageUrl: '',
//         deadline,
//         deadLineMax: deadline,
//         supplier,
//         probability: 99.9,
//         needToCheckBrand: needToCheckBrand,
//       };

//       allResults.push(resultItem);
//     } catch (error) {
//       console.error(`Ошибка при парсинге строки: ${error}`);
//       continue;
//     }
//   }
//   console.log(chalk.greenBright(allResults[0]));
//   return allResults;
// };

export const parsePickedTurboCarsResults = async ({
  page,
  item,
  supplier,
}: ParallelSearchParams): Promise<SearchResultsParsed[]> => {
  const results = await page.$$eval(
    'table.noborder.ss tr.aaa',
    (rows: HTMLTableRowElement[], itemBrand: string) => {
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
            //!!! нужны значки больше меньше вместо кодов.
            const secondTdHtml = tds[1].innerHTML;
            const availabilityMatch = secondTdHtml.match(/<b>(.*?)<\/b>/);
            let availability = '';
            if (availabilityMatch) {
              availability = availabilityMatch[1].replace(/шт\./, '').trim();
            }

            //!!! Извлекаем бренд из ссылки с onclick, содержащим "Поставщик"
            //!!! Нужно чинить, бренда нет!
            let brand = '';
            const brandAnchor = row.querySelector('a[onclick*="Поставщик"]');
            if (brandAnchor && brandAnchor.textContent) {
              brand = brandAnchor.textContent.trim();
            }

            //!!! Извлекаем описание из td, где соседний td имеет текст "Наименование"
            let description = '';
            const tdsAll = row.closest('table')!.querySelectorAll('td');
            for (let i = 0; i < tdsAll.length; i++) {
              if (tdsAll[i].innerText.trim() === 'Наименование') {
                description = tdsAll[i + 1]?.innerText.trim() || '';
                break;
              }
            }

            let price = 0;
            const priceSpan = document.querySelector('#mypricespan b');
            if (priceSpan && priceSpan.textContent) {
              const priceText = priceSpan.textContent.trim();
              price = parseFloat(
                priceText.replace(/[^\d.,]/g, '').replace(',', '.')
              );
            }

            const formattedItemBrand = itemBrand
              .toLowerCase()
              .replace(/\s+/g, '');
            const formattedExtractedBrand = brand
              .toLowerCase()
              .replace(/\s+/g, '');
            const needToCheckBrand =
              formattedItemBrand !== formattedExtractedBrand;

            return {
              id: '',
              article: '',
              brand,
              description,
              availability,
              price,
              warehouse,
              imageUrl: '',
              deadline,
              deadLineMax: deadline,
              supplier: '',
              probability: 99.9,
              needToCheckBrand: needToCheckBrand,
            };
          } catch (error) {
            console.error(`Ошибка при обработке строки: ${error}`);
            return null;
          }
        })
        .filter((item) => item !== null);
    },
    item.brand || ''
  );

  const allResults: SearchResultsParsed[] = results.map(
    (result: SearchResultsParsed) => ({
      ...result,
      id: uuidv4(),
      article: item.article,
      supplier,
    })
  );

  return allResults;
};

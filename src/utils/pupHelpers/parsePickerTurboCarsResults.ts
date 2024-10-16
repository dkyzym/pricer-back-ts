import { logger } from 'config/logger';
import { ElementHandle, Page } from 'puppeteer';
import {
  ItemToParallelSearch,
  ParallelSearchParams,
  SearchResultsParsed,
} from 'types';
import { v4 as uuidv4 } from 'uuid';
import { isBrandMatch } from '../data/isBrandMatch';
import { needToCheckBrand } from '../data/needToCheckBrand';

// Helper function to check element visibility
const isElementVisible = async (
  page: Page,
  element: ElementHandle<Element>
): Promise<boolean> => {
  return await page.evaluate((el) => {
    const style = window.getComputedStyle(el);
    return (
      style &&
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      (el as HTMLElement).offsetHeight > 0 &&
      (el as HTMLElement).offsetWidth > 0
    );
  }, element);
};

// Helper function to normalize brand names and handle variations like parentheses
const normalizeBrandNameExtended = (brand: string): string[] => {
  const normalized = brand.replace(/\s+/g, '').toLowerCase();
  const parts = normalized
    .split(/[()]/)
    .filter(Boolean)
    .map((part) => part.trim());
  return parts.length > 1 ? [normalized, ...parts] : [normalized];
};

export const isInStock = async (
  page: Page,
  item: ItemToParallelSearch
): Promise<boolean> => {
  const firstRowSelector = '#block0';

  // Decode and normalize the brand name
  const brandVariants = normalizeBrandNameExtended(
    decodeURIComponent(item.brand)
  );

  // Find the parent element and check if it's visible
  const parentElementHandle = await page.$(firstRowSelector);
  if (
    !parentElementHandle ||
    !(await isElementVisible(page, parentElementHandle))
  ) {
    return false;
  }

  // Find all <tr> elements inside the parent element
  const trHandles = await parentElementHandle.$$(':scope > tr');

  for (const trHandle of trHandles) {
    // Check if the class list or text content contains the brand name
    const { classList, textContent } = await page.evaluate(
      (el) => ({
        classList: Array.from(el.classList),
        textContent: el.textContent || '',
      }),
      trHandle
    );

    const normalizedClassList = classList.map((cls) =>
      cls.replace(/\s+/g, '').toLowerCase()
    );

    // Use the brand matching function to verify if the brand matches
    const hasMatchingClass = normalizedClassList.some((cls) =>
      brandVariants.some((variant) => isBrandMatch(variant, cls))
    );

    // Extend the text content check to include matches for partial brand names (like SANGSIN and HI-Q)
    const textParts = textContent
      .toLowerCase()
      .split(/[()]/)
      .filter(Boolean)
      .map((part) => part.trim());
    const hasMatchingTextContent = textParts.some((part) =>
      brandVariants.some((variant) => isBrandMatch(variant, part))
    );

    if (
      (hasMatchingClass || hasMatchingTextContent) &&
      (await isElementVisible(page, trHandle))
    ) {
      return true;
    }

    // Dispose the handle to prevent memory leaks
    await trHandle.dispose();
  }

  // Dispose the parent element handle
  await parentElementHandle.dispose();

  return false;
};

export const parsePickedTurboCarsResults = async ({
  page,
  item,
  supplier,
}: ParallelSearchParams): Promise<SearchResultsParsed[]> => {
  await page.waitForSelector('#codeinfo', { visible: true, timeout: 60_000 });

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
            logger.warn(`${page.url()} Ошибка при обработке строки: ${error}`);
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

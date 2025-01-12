import * as cheerio from 'cheerio';
import { ParallelSearchParams, SearchResultsParsed } from 'types/index.js';
import { calculateDeliveryDate } from './calculateDates/index.js';
import { filterEqualResults } from './data/filterEqualResults.js';

interface ParseParams extends ParallelSearchParams {
  html: string;
}

export const parseData = async (
  $: cheerio.CheerioAPI
): Promise<Omit<SearchResultsParsed, 'supplier'>[]> => {
  const data: Omit<SearchResultsParsed, 'supplier'>[] = [];

  $('[class^="resultTr2"]').each((_, row) => {
    const $row = $(row);

    const article = $row.find('.resultPartCode a').text().trim();
    const brand = $row.find('.resultBrand a').text().trim();
    const description = $row.find('.resultDescription').text().trim();
    const warehouse = $row.find('.resultWarehouse').text().trim();
    const imageUrl = $row.find('.resultImage img').attr('src') || '';
    const probabilityText = $row
      .find('.resultProbability')
      .text()
      .replace('%', '')
      .trim();
    const probability = parseFloat(probabilityText) || 0;
    const id =
      $row.find('input.quantityInputFake').attr('searchresultuniqueid') || '';
    const multiText =
      $row.find('input.addToBasketLinkFake').attr('packing') || '1';
    const multi = Number(multiText);
    const allowReturnTitle =
      $row.find('.fr-icon2-minus-circled.fr-text-danger').attr('title') || '';
    const allow_return = allowReturnTitle.includes(
      'не подлежит возврату или обмену'
    )
      ? '0'
      : '1';

    const availabilityText = $row.attr('data-availability') || '0';
    const priceText = $row.attr('data-output-price') || '0';
    const deadlineText = $row.attr('data-deadline') || '0';
    const deadLineMaxText = $row.attr('data-deadline-max') || '0';

    const availability = parseInt(availabilityText, 10) || 0;
    const price = parseFloat(priceText) || 0;
    const deadline = parseInt(deadlineText, 10) || 0;
    const deadLineMax = parseInt(deadLineMaxText, 10) || 0;

    const product: Omit<SearchResultsParsed, 'supplier'> = {
      article,
      brand,
      description,
      availability,
      price,
      warehouse,
      imageUrl,
      deadline,
      deadLineMax,
      probability,
      id,
      multi,
      allow_return,
    };

    if (price) {
      data.push(product);
    }
  });

  return data;
};

export const parsePickedABCPresults = async ({
  html,
  item,
  supplier,
}: ParseParams): Promise<SearchResultsParsed[]> => {
  const $ = cheerio.load(html);

  // Wait for any dynamic content if necessary (simulate wait)
  // Since we're dealing with server-rendered HTML, this may not be necessary

  const currentData = await parseData($);

  if (currentData.length > 0) {
    const resultsWithSupplier = currentData
      .map((product) => ({ ...product, supplier }))
      .filter((product) => product.warehouse !== 'Внешний склад');
    const filteredResults = filterEqualResults(resultsWithSupplier, item);
    const resultsWithDeliveryDate = filteredResults.map((result) => ({
      ...result,
      deliveryDate: calculateDeliveryDate(result),
    }));
    return resultsWithDeliveryDate;
  }
  return [];
};

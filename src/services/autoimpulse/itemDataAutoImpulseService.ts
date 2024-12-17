import { logger } from 'config/logger';
import { ParallelSearchParams, SearchResultsParsed } from 'types';

import * as cheerio from 'cheerio';

import { ugHeaders } from '../../constants/headers';
import { makeAutoImpulseRequest } from '../../utils/makeAutoimpulseRequest';
import { parsePickedABCPresults } from '../../utils/parsePickedABCPresults';

export const itemDataAutoImpulseService = async ({
  item,
  supplier,
}: ParallelSearchParams): Promise<SearchResultsParsed[]> => {
  // const { selectors } = SUPPLIERS_DATA['autoImpulse'];
  const BASE_URL = 'https://lnr-auto-impulse.ru';
  const searchUrl = `${BASE_URL}/search?pcode=${encodeURIComponent(item.article)}`;
  const headers = ugHeaders; // Import your headers

  // First GET request
  const response = await makeAutoImpulseRequest(searchUrl, { headers });
  const $ = cheerio.load(response.data);

  const dataLinkContent = `${encodeURIComponent(item.brand)}/${encodeURIComponent(item.article)}`;

  // Since cheerio doesn't support the 'i' flag for case-insensitive attribute matching,
  // we'll select all elements and filter them manually
  const elements = $('.startSearching').filter((_, el) => {
    const dataLink = $(el).attr('data-link') || '';
    return (
      dataLink.toLowerCase() === `/search/${dataLinkContent.toLowerCase()}`
    );
  });

  if (elements.length > 0) {
    logger.info(`[${supplier}] Элемент существует, выполняем второй запрос.`);

    const detailUrl = `${BASE_URL}/search/${encodeURIComponent(item.brand)}/${encodeURIComponent(item.article)}`;
    const detailResponse = await makeAutoImpulseRequest(detailUrl, { headers });

    const allResults = await parsePickedABCPresults({
      html: detailResponse.data,
      item,
      supplier,
    });

    return allResults;
  } else {
    logger.info(
      `${supplier} Элемент не найден. Продолжаем без второго запроса.`
    );
    // Optionally, you can parse results from the initial response if applicable
    const allResults = await parsePickedABCPresults({
      html: response.data,
      item,
      supplier,
    });

    return allResults;
  }
};

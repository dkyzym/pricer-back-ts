import { SUPPLIERS_DATA } from '@constants/index';
import { logger } from 'config/logger';
import { ParallelSearchParams, SearchResultsParsed } from 'types';

import * as cheerio from 'cheerio';

import { logResultCount } from 'utils/stdLogs';
import { ugHeaders } from '../../constants/headers';
import { parsePickedUgResults } from '../../utils/pupHelpers/parsePickedUgResults';
import { clientPatriot } from './loginPartiot';

export const itemDataPatriotService = async ({
  item,
  supplier,
}: ParallelSearchParams): Promise<SearchResultsParsed[]> => {
  const { selectors } = SUPPLIERS_DATA['patriot'];
  const searchUrl = `https://optautotorg.com/search?pcode=${encodeURIComponent(item.article)}`;
  const headers = ugHeaders; // Import your headers

  // First GET request
  const response = await clientPatriot.get(searchUrl, { headers });
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
    // Second GET request
    const detailUrl = `https://optautotorg.com/search/${encodeURIComponent(item.brand)}/${encodeURIComponent(item.article)}`;
    const detailResponse = await clientPatriot.get(detailUrl, { headers });
    const allResults = await parsePickedUgResults({
      html: detailResponse.data,
      item,
      supplier,
    });
    logResultCount(item, supplier, allResults);
    return allResults;
  } else {
    logger.info(
      `${supplier} Элемент не найден. Продолжаем без второго запроса.`
    );
    // Optionally, you can parse results from the initial response if applicable
    const allResults = await parsePickedUgResults({
      html: response.data,
      item,
      supplier,
    });
    logResultCount(item, supplier, allResults);
    return allResults;
  }
};

// import { ParallelSearchParams, SearchResultsParsed } from 'types/index.js';

// import * as cheerio from 'cheerio';

// import { ugHeaders } from '../../constants/headers.js';
// import { makePatriotRequest } from '../../utils/makePatriotRequest.js';
// import { parsePickedABCPresults } from '../../utils/parsePickedABCPresults.js';

// export const itemDataPatriotService = async ({
//   item,
//   supplier,
//   userLogger,
// }: ParallelSearchParams): Promise<SearchResultsParsed[]> => {
//   // const { selectors } = SUPPLIERS_DATA['patriot'];
//   const searchUrl = `https://optautotorg.com/search?pcode=${encodeURIComponent(item.article)}`;
//   const headers = ugHeaders; // Import your headers

//   // First GET request
//   const response = await makePatriotRequest(searchUrl, { headers });
//   const $ = cheerio.load(response.data);

//   const dataLinkContent = `${encodeURIComponent(item.brand)}/${encodeURIComponent(item.article)}`;

//   // Since cheerio doesn't support the 'i' flag for case-insensitive attribute matching,
//   // we'll select all elements and filter them manually
//   const elements = $('.startSearching').filter((_, el) => {
//     const dataLink = $(el).attr('data-link') || '';
//     return (
//       dataLink.toLowerCase() === `/search/${dataLinkContent.toLowerCase()}`
//     );
//   });

//   if (elements.length > 0) {
//     userLogger.info(
//       `[${supplier}] Элемент существует, выполняем второй запрос.`
//     );

//     const detailUrl = `https://optautotorg.com/search/${encodeURIComponent(item.brand)}/${encodeURIComponent(item.article)}`;
//     const detailResponse = await makePatriotRequest(detailUrl, { headers });

//     const allResults = await parsePickedABCPresults({
//       html: detailResponse.data,
//       item,
//       supplier,
//       userLogger,
//     });

//     return allResults;
//   } else {
//     userLogger.info(
//       `${supplier} Элемент не найден. Продолжаем без второго запроса.`
//     );
//     // Optionally, you can parse results from the initial response if applicable
//     const allResults = await parsePickedABCPresults({
//       html: response.data,
//       item,
//       supplier,
//       userLogger,
//     });

//     return allResults;
//   }
// };

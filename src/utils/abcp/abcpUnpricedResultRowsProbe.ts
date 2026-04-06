import * as cheerio from 'cheerio';

/**
 * Проверяет «недозаполненный» HTML ABCP: строки resultTr2 уже есть, но ни в одной
 * data-output-price ещё не проставлена положительная цена (сервер отдал шаблон до прайса).
 */
export const abcpHtmlHasUnpricedResultRows = (html: string): boolean => {
  const $ = cheerio.load(html);
  const rows = $('[class^="resultTr2"]');
  if (rows.length === 0) {
    return false;
  }
  let anyPositivePrice = false;
  rows.each((_i, el) => {
    const price = parseFloat($(el).attr('data-output-price') || '0') || 0;
    if (price > 0) {
      anyPositivePrice = true;
      return false; // cheerio: прервать обход
    }
  });
  return !anyPositivePrice;
};

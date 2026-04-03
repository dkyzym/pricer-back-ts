/**
 * Примеры: «Заказ № 1429 оформлен.» / «Заказ №12345 успешно оформлен».
 * Общий разбор для редиректа после AJAX-createOrder и для HTML-ответа MAS после POST /cart.
 */
export const parseExternalOrderIdFromHtml = (html: string): string | null => {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const fromText = text.match(/Заказ\s*№?\s*(\d+)(?:\s+успешно)?\s+оформлен/i);
  if (fromText?.[1]) return fromText[1];

  const fromHtmlWithTags = html.match(
    /Заказ(?:\s|&nbsp;|<[^>]+>)*№?\s*(\d+)(?:\s|&nbsp;|<[^>]+>)*(?:успешно(?:\s|&nbsp;|<[^>]+>)*)?оформлен/i,
  );
  if (fromHtmlWithTags?.[1]) return fromHtmlWithTags[1];

  const fromOrderFilter = html.match(/filter%5Bnumber%5D=(\d+)/i);
  if (fromOrderFilter?.[1]) return fromOrderFilter[1];

  const fromOrderIdQuery = html.match(/[?&]orderId=(\d+)/i);
  return fromOrderIdQuery?.[1] ?? null;
};

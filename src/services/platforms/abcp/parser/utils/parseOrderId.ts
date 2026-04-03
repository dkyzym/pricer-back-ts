/**
 * Примеры:
 *  — «Заказ № 1429 оформлен.» / «Заказ <a>№ 1458</a> оформлен» (стандартная тема / Mikano)
 *  — «Заказу присвоен номер <b>256741120</b>» (тема MAS / AutoImpulse)
 *  — filter[number]=1458 / orderId=1458 (URL-фолбэки)
 */
export const parseExternalOrderIdFromHtml = (html: string): string | null => {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  const fromConfirmed = text.match(/Заказ\s*№?\s*(\d+)(?:\s+успешно)?\s+оформлен/i);
  if (fromConfirmed?.[1]) return fromConfirmed[1];

  const fromAssigned = text.match(/присвоен\s+номер\s*(\d+)/i);
  if (fromAssigned?.[1]) return fromAssigned[1];

  const fromHtmlWithTags = html.match(
    /Заказ(?:\s|&nbsp;|<[^>]+>)*№?\s*(\d+)(?:\s|&nbsp;|<[^>]+>)*(?:успешно(?:\s|&nbsp;|<[^>]+>)*)?оформлен/i,
  );
  if (fromHtmlWithTags?.[1]) return fromHtmlWithTags[1];

  const fromAssignedWithTags = html.match(
    /присвоен\s+номер(?:\s|&nbsp;|<[^>]+>)*(\d+)/i,
  );
  if (fromAssignedWithTags?.[1]) return fromAssignedWithTags[1];

  const fromOrderFilter = html.match(/filter%5Bnumber%5D=(\d+)/i);
  if (fromOrderFilter?.[1]) return fromOrderFilter[1];

  const fromOrderIdQuery = html.match(/[?&]orderId=(\d+)/i);
  return fromOrderIdQuery?.[1] ?? null;
};

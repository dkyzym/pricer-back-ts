/**
 * Примеры: «Заказ № 1429 оформлен.» / «Заказ №12345 успешно оформлен».
 * Общий разбор для редиректа после AJAX-createOrder и для HTML-ответа MAS после POST /cart.
 */
export const parseExternalOrderIdFromHtml = (html: string): string | null => {
  const match = html.match(/Заказ\s*№?\s*(\d+)/i);
  return match?.[1] ?? null;
};

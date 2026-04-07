import { cleanArticleString } from '../data/brand/cleanArticleString.js';

/**
 * Нормализация артикула для склейки заглушек виртуальной корзины с строками синка.
 * Та же логика, что при поиске запчастей (cleanArticleString).
 */
export const normalizeArticleForReconciliation = (article: string): string => {
  const trimmed = article.trim();
  if (!trimmed) return '';
  return cleanArticleString(trimmed);
};

const stripLeadingOrderIdDecorations = (value: string): string => {
  let s = value;
  let prev: string;
  do {
    prev = s;
    s = s
      .replace(/^№\s*/u, '')
      .replace(/^#\s*/, '')
      .replace(/^N[Oo]\.\s*/i, '');
  } while (s !== prev);
  return s;
};

/**
 * Нормализация внешнего номера заказа для склейки.
 * Снимаются только явные служебные префиксы (№, No., #); буквенно-цифровое тело
 * (в т.ч. ORD-12345 → ORD12345) сохраняется через cleanArticleString.
 */
export const normalizeOrderIdForReconciliation = (orderId: string): string => {
  let s = orderId.trim().replace(/\u00a0/g, ' ');
  s = stripLeadingOrderIdDecorations(s.trim());
  if (!s) return '';
  return cleanArticleString(s);
};

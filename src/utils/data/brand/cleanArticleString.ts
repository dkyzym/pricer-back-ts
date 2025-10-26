export const cleanArticleString = (article: string): string => {
  let normalized = article.toUpperCase(); // Приводим к верхнему регистру

  normalized = normalized.replace(/[\s\-]/g, ''); // Удаляем пробелы и дефисы

  normalized = normalized.replace(/[^A-Z0-9А-Я]/g, '');

  return normalized;
};

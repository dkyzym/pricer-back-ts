import { transliterate as tr } from 'transliteration';

export const standardizeString = (brand: string): string => {
  let normalized = brand.toUpperCase(); // Приводим к верхнему регистру

  normalized = normalized.replace(/[\s\-]/g, ''); // Удаляем пробелы и дефисы

  normalized = tr(normalized); // Транслитерируем

  normalized = normalized.replace(/[^A-Z0-9]/g, ''); // Удаляем неалфавитно-цифровые символы
  // Мы используем /AUTO/g, чтобы заменить *все* вхождения
  normalized = normalized.replace(/AUTO/g, 'AVTO');

  return normalized;
};

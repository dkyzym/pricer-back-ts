/**
 * Парсит поле availability из снимка позиции (число или строка вида "10", "10+", ">100").
 * Единая логика для актуализации корзины и PATCH количества — без обращения к внешним API.
 */
export const parseAvailability = (value: number | string): number | null => {
  if (typeof value === 'number') return value;
  const parsed = parseInt(value, 10);
  if (!Number.isNaN(parsed)) return parsed;
  const digits = value.replace(/\D/g, '');
  return digits ? parseInt(digits, 10) : null;
};

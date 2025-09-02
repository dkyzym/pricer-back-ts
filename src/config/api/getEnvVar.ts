/**
 * Безопасно получает переменную окружения.
 * Выбрасывает понятную ошибку, если переменная не определена,
 * что предотвращает падение приложения в неожиданных местах.
 * @param name - Имя переменной окружения (например, 'UG_USERNAME')
 * @returns Значение переменной, если она найдена
 * @throws {Error} Если переменная не найдена
 */
export function getEnvVar(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === null || value === '') {
    throw new Error(
      `Ошибка конфигурации: Обязательная переменная окружения "${name}" не определена в .env файле.`
    );
  }
  return value;
}

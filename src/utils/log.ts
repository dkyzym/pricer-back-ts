import chalk from 'chalk';

/**
 * Генерирует случайный HEX цвет.
 * @returns {string} Случайный HEX цвет в формате #RRGGBB.
 */
function getRandomHexColor(): string {
  const hex = Math.floor(Math.random() * 0xffffff).toString(16);
  return `#${'0'.repeat(6 - hex.length)}${hex}`;
}

/**
 * Вычисляет яркость цвета по формуле восприятия.
 * @param {string} hex - HEX цвет в формате #RRGGBB.
 * @returns {number} Значение яркости.
 */
function getBrightness(hex: string): number {
  // Удаляем символ '#' если он присутствует
  const cleanedHex = hex.replace('#', '');

  // Парсим значения R, G и B
  const r = parseInt(cleanedHex.substring(0, 2), 16);
  const g = parseInt(cleanedHex.substring(2, 4), 16);
  const b = parseInt(cleanedHex.substring(4, 6), 16);

  // Вычисляем яркость по формуле восприятия
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Логирует сообщение с случайным фоновым цветом и контрастным цветом текста.
 * @param {string} message - Сообщение для логирования.
 */
function logWithRandomBackground(message: string): void {
  const bgColor = getRandomHexColor();
  const brightness = getBrightness(bgColor);

  // Выбираем цвет текста в зависимости от яркости фона
  const textColor = brightness > 128 ? 'black' : 'white';

  // Форматируем сообщение с помощью chalk
  const styledMessage =
    textColor === 'black'
      ? chalk.bgHex(bgColor).black(` ${message} `)
      : chalk.bgHex(bgColor).white(` ${message} `);

  console.log(styledMessage);
}

// Пример использования
// logWithRandomBackground('Это тестовое сообщение');
// logWithRandomBackground('Другое сообщение для логирования');

export { logWithRandomBackground };

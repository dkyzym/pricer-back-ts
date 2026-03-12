/**
 * Передаёт управление Event Loop через setImmediate.
 * Позволяет Node.js обработать таймеры (setTimeout/setInterval),
 * I/O-коллбеки и AbortSignal между тяжёлыми синхронными
 * вычислениями (cheerio.load, DOM-итерации, BSON-сериализация).
 *
 * setImmediate планирует callback в фазе "check" Event Loop.
 * Между check и следующей итерацией проходит фаза "timers",
 * что даёт AbortController и node-cron шанс сработать.
 */
export const yieldToEventLoop = (): Promise<void> =>
  new Promise((resolve) => setImmediate(resolve));

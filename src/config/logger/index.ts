import path from 'path';
import { addColors, createLogger, format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const { combine, timestamp, printf, colorize, errors, uncolorize } = format;

const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'bold',
    http: 'magenta',
    debug: 'blue',
  },
};

type LogLevel = keyof typeof customLevels.levels;

// Подключаем цвета
addColors(customLevels.colors);

/**
 * Фильтрующий формат (оставляет только нужный уровень).
 */
const filterOnly = (level: LogLevel) => {
  return format((info) => (info.level === level ? info : false))();
};

/**
 * Улучшенный формат для ошибок:
 * Позволяет увидеть stack trace, если пишем Error-объекты.
 * Нужно использовать errors({ stack: true }).
 */
const errorStackFormat = combine(
  errors({ stack: true }), // перенос stack trace в поле info
  format((info) => {
    // Если внутри info есть stack, добавляем её в сообщение
    if (info.stack) {
      info.message = `${info.message}\n${info.stack}`;
    }
    return info;
  })()
);

/**
 * Общий формат для логов:
 *  - Раскраска (для консоли)
 *  - timestamp
 *  - читаемый вывод (printf)
 *  - убираем цветовое оформление при записи в файл (uncolorize)
 */
const consoleLogFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'HH:mm:ss' }),
  printf((info) => `[${info.timestamp}] [${info.level}]: ${info.message}`)
);

const fileLogFormat = combine(
  uncolorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  printf((info) => `[${info.timestamp}] [${info.level}]: ${info.message}`)
);

/**
 * Создаём logger
 */
export const logger = createLogger({
  levels: customLevels.levels,
  level: 'debug',
  format: combine(
    errorStackFormat, // Добавляем форматирование ошибок со stack trace
    fileLogFormat
  ),
  transports: [
    // Консоль
    new transports.Console({
      format: consoleLogFormat,
    }),

    // —————  Daily Rotate File (сохраняем логи по датам, держим 90 дней) —————
    // Общий файл
    new DailyRotateFile({
      dirname: path.join('logs'),
      filename: 'combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '90d', // хранение 90 дней
      maxSize: '20m', // опционально: ограничение размера
      level: 'debug', // пишем все уровни
    }),
    // Файл только с ошибками
    new DailyRotateFile({
      dirname: path.join('logs'),
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '90d',
      maxSize: '20m',
      level: 'error',
      format: combine(filterOnly('error'), errorStackFormat, fileLogFormat),
    }),
    // Файл только с warn
    new DailyRotateFile({
      dirname: path.join('logs'),
      filename: 'warn-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '90d',
      maxSize: '20m',
      level: 'warn',
      format: combine(filterOnly('warn'), fileLogFormat),
    }),
    // Файл только с debug
    new DailyRotateFile({
      dirname: path.join('logs'),
      filename: 'debug-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '90d',
      maxSize: '20m',
      level: 'debug',
      format: combine(filterOnly('debug'), fileLogFormat),
    }),
    // Файл только с info
    new DailyRotateFile({
      dirname: path.join('logs'),
      filename: 'info-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '90d',
      maxSize: '20m',
      level: 'info',
      format: combine(filterOnly('info'), fileLogFormat),
    }),
  ],
});

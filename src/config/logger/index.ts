import path from 'path';
import { addColors, createLogger, format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const { combine, colorize, errors, timestamp, printf, json, uncolorize } =
  format;

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

// Подключаем цвета для консоли
addColors(customLevels.colors);

/**
 * Фильтрует сообщения, оставляя только указанный уровень.
 */
const filterOnly = (level: LogLevel) => {
  return format((info) => (info.level === level ? info : false))();
};

/**
 * Формат для консоли: хотим видеть цвета + красивый вывод + stack trace для ошибок.
 */
const consoleFormat = combine(
  colorize({ all: true }),
  errors({ stack: true }),
  timestamp({ format: 'HH:mm:ss' }),
  printf(({ timestamp, level, message, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
    return `[${timestamp}] [${level}] ${message}${stack ? `\n${stack}` : ''} ${metaStr}`;
  })
);

/**
 * Формат для файлов:
 *  - убираем цвет (uncolorize())
 *  - выводим stack trace для ошибок
 */
const fileJsonFormat = combine(
  uncolorize(),
  errors({ stack: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  json() // Все поля (timestamp, level, message, user, role и т.д.) будут в JSON
);

/**
 * Настраиваем logger с различными DailyRotateFile-транспортами
 * и одним Console-транспортом (с цветом).
 */
export const logger = createLogger({
  levels: customLevels.levels,
  level: 'debug', // по умолчанию логируем всё вплоть до debug
  transports: [
    // ========= Консоль (с цветами) =========
    new transports.Console({
      format: consoleFormat,
    }),

    // ========= Общий файл (ежедневно новый, хранение 90 дней) =========
    new DailyRotateFile({
      dirname: path.join('logs/combined'),
      filename: 'combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '90d',
      maxSize: '20m',
      level: 'debug',
      format: fileJsonFormat,
    }),
    // ========= Отдельные файлы на каждый уровень (по желанию) =========
    new DailyRotateFile({
      dirname: path.join('logs/error'),
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '90d',
      maxSize: '20m',
      level: 'error',
      format: combine(filterOnly('error'), fileJsonFormat),
    }),
    new DailyRotateFile({
      dirname: path.join('logs/warn'),
      filename: 'warn-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '90d',
      maxSize: '20m',
      level: 'warn',
      format: combine(filterOnly('warn'), fileJsonFormat),
    }),
    new DailyRotateFile({
      dirname: path.join('logs/info'),
      filename: 'info-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '90d',
      maxSize: '20m',
      level: 'info',
      format: combine(filterOnly('info'), fileJsonFormat),
    }),
    new DailyRotateFile({
      dirname: path.join('logs/http'),
      filename: 'http-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '90d',
      maxSize: '20m',
      level: 'http', // <--
      format: combine(filterOnly('http'), fileJsonFormat),
    }),
    new DailyRotateFile({
      dirname: path.join('logs/debug'),
      filename: 'debug-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '90d',
      maxSize: '20m',
      level: 'debug',
      format: combine(filterOnly('debug'), fileJsonFormat),
    }),
  ],
});

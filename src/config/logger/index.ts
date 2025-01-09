import path from 'path';
import { addColors, createLogger, format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const { combine, colorize, errors, timestamp, printf, uncolorize } = format;

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
  errors({ stack: true }), // если прокинем Error-объект, выведет stack
  timestamp({ format: 'HH:mm:ss' }),
  printf((info) => {
    // Если есть stack (ошибки), добавляем в сообщение
    const msg = info.stack ? `${info.message}\n${info.stack}` : info.message;
    return `[${info.timestamp}] [${info.level}]: ${msg}`;
  })
);

/**
 * Формат для файлов:
 *  - убираем цвет (uncolorize())
 *  - выводим stack trace для ошибок
 */
const fileFormat = combine(
  uncolorize(),
  errors({ stack: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  printf((info) => {
    const msg = info.stack ? `${info.message}\n${info.stack}` : info.message;
    return `[${info.timestamp}] [${info.level}]: ${msg}`;
  })
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
      dirname: path.join('logs'),
      filename: 'combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '90d',
      maxSize: '20m',
      level: 'debug',
      format: fileFormat,
    }),
    // ========= Отдельные файлы на каждый уровень (по желанию) =========
    new DailyRotateFile({
      dirname: path.join('logs'),
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '90d',
      maxSize: '20m',
      level: 'error',
      format: combine(filterOnly('error'), fileFormat),
    }),
    new DailyRotateFile({
      dirname: path.join('logs'),
      filename: 'warn-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '90d',
      maxSize: '20m',
      level: 'warn',
      format: combine(filterOnly('warn'), fileFormat),
    }),
    new DailyRotateFile({
      dirname: path.join('logs'),
      filename: 'info-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '90d',
      maxSize: '20m',
      level: 'info',
      format: combine(filterOnly('info'), fileFormat),
    }),
    new DailyRotateFile({
      dirname: path.join('logs'),
      filename: 'debug-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '90d',
      maxSize: '20m',
      level: 'debug',
      format: combine(filterOnly('debug'), fileFormat),
    }),
  ],
});

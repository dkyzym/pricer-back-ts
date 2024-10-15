import { addColors, createLogger, format, transports } from 'winston';
import { ignoreSpecificMessages } from './ignoreSpecificMessages';
const { combine, timestamp, printf, colorize } = format;

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
    info: 'green',
    http: 'magenta',
    debug: 'blue',
  },
};

addColors(customLevels.colors);

const logFilesFormat = combine(
  ignoreSpecificMessages(),
  timestamp({
    format: 'YYYY-MM-DD HH:mm:ss',
  }),
  printf((info) => `[${info.timestamp}] [${info.level}]: ${info.message}`)
);

export const logger = createLogger({
  levels: customLevels.levels,
  level: 'debug',
  format: logFilesFormat,
  transports: [
    new transports.Console({
      format: combine(
        colorize({ all: true }),
        timestamp({ format: 'HH:mm:ss' }),
        printf((info) => `[${info.timestamp}] [${info.level}]: ${info.message}`)
      ),
    }),
    new transports.File({
      filename: 'combined.log',
      format: format.uncolorize(),
    }),
    new transports.File({
      filename: 'error.log',
      level: 'error',
      dirname: 'logs',
      format: format.uncolorize(),
    }),
    new transports.File({
      filename: 'warn.log',
      level: 'warn',
      dirname: 'logs',
      format: format.uncolorize(),
    }),
    new transports.File({
      filename: 'debug.log',
      level: 'debug',
      dirname: 'logs',
      format: format.uncolorize(),
    }),
    new transports.File({
      filename: 'info.log',
      level: 'info',
      dirname: 'logs',
      format: format.uncolorize(),
    }),
  ],
});

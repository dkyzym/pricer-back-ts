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

type LogLevel = keyof typeof customLevels.levels;

addColors(customLevels.colors);

const logFilesFormat = combine(
  ignoreSpecificMessages(),
  timestamp({
    format: 'YYYY-MM-DD HH:mm:ss',
  }),
  printf((info) => `[${info.timestamp}] [${info.level}]: ${info.message}`)
);

const filterOnly = (level: LogLevel) => {
  return format((info) => {
    return info.level === level ? info : false;
  })();
};

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
      format: combine(format.uncolorize(), logFilesFormat),
    }),
    new transports.File({
      filename: 'error.log',
      dirname: 'logs',
      format: combine(filterOnly('error'), format.uncolorize(), logFilesFormat),
    }),
    new transports.File({
      filename: 'warn.log',
      dirname: 'logs',
      format: combine(filterOnly('warn'), format.uncolorize(), logFilesFormat),
    }),
    new transports.File({
      filename: 'debug.log',
      dirname: 'logs',
      format: combine(filterOnly('debug'), format.uncolorize(), logFilesFormat),
    }),
    new transports.File({
      filename: 'info.log',
      dirname: 'logs',
      format: combine(filterOnly('info'), format.uncolorize(), logFilesFormat),
    }),
  ],
});

import { ChalkInstance } from 'chalk';

interface LogOptions {
  color: ChalkInstance;
}

// Основная функция логирования с использованием chalk
export const log = (message: any, options: LogOptions): void => {
  const timestamp = new Date().toISOString();
  const formattedMessage = options.color(`[${timestamp}]: ${message}`);

  console.log(formattedMessage);
};

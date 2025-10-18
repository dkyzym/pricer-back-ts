import axios, { AxiosError } from 'axios';
import { ProviderErrorData } from 'types/index.js';
import { Logger } from 'winston';

enum ProviderErrorCodes {
  ObjectNotFound = 301,
}

// Пользовательский класс ошибки для четкой идентификации
export class AbcpError extends Error {
  constructor(
    message: string,
    public isSuccessWithNoData: boolean = false
  ) {
    super(message);
    this.name = 'AbcpError';
  }
}

// Эта функция теперь не отправляет события, а СОЗДАЕТ ошибку.
export const createAbcpError = (
  err: unknown,
  supplier: string,
  userLogger: Logger
): AbcpError => {
  if (!axios.isAxiosError(err)) {
    const message = (err as Error)?.message || 'Unknown non-Axios error';
    userLogger.error(`${supplier} supplier: Non-Axios error occurred.`, {
      message,
    });
    return new AbcpError(message);
  }

  const axiosError = err as AxiosError<ProviderErrorData>;

  if (!axiosError.response) {
    const message = axiosError.message || 'Unknown network error';
    userLogger.error(`${supplier} supplier: Network or unknown error`, {
      message,
    });
    return new AbcpError(message);
  }

  const { data: providerData } = axiosError.response;
  const errorCode = providerData?.errorCode;
  const errorMessage = providerData?.errorMessage;

  if (errorCode === ProviderErrorCodes.ObjectNotFound) {
    // Особый случай: это не ошибка, а успешный ответ "ничего не найдено"
    return new AbcpError('Ничего не нашли', true);
  }

  const finalMessage = errorMessage || axiosError.message;
  userLogger.error(
    `${supplier} supplier error: code=${errorCode}, message="${finalMessage}"`
  );
  return new AbcpError(finalMessage);
};

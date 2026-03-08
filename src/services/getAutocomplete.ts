import axios, { AxiosError } from 'axios';
import chalk from 'chalk';
import { HttpsCookieAgent } from 'http-cookie-agent/http';
import { CookieJar } from 'tough-cookie';
import { ugHeaders } from '../constants/headers.js';

// Переменные модуля
const cookieJar = new CookieJar();

// Включаем keepAlive для максимальной скорости автокомплита
const httpsAgent = new HttpsCookieAgent({
  cookies: { jar: cookieJar },
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 50, // Для автокомплита разрешаем больше одновременных сокетов
});

const client = axios.create({
  httpsAgent,
  withCredentials: true,
});

let initializationPromise: Promise<void> | null = null;

/**
 * Singleton Promise для инициализации куки.
 */
const initializeCookies = (): Promise<void> => {
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = client
    .get('https://ugautopart.ru/', { headers: ugHeaders })
    .then(() => {
      console.log(chalk.green('Куки Автокомплита ЮГ успешно инициализированы'));
    })
    .catch((error) => {
      initializationPromise = null;
      console.error('Ошибка при инициализации куки:', error);
      throw error;
    });

  return initializationPromise;
};

/**
 * Получает подсказки автокомплита от поставщика UG.
 */
export const getAutocomplete = async (term: string): Promise<any> => {
  const url = `https://ugautopart.ru/ajax/modules2/search.tips/get`;

  await initializeCookies();

  try {
    const response = await client.get(url, {
      params: { term, locale: 'ru_RU' },
      headers: ugHeaders,
    });

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      if (axiosError.response?.status === 400) {
        console.warn(
          'Куки, возможно, истекли. Переинициализируем куки и повторяем запрос.'
        );

        initializationPromise = null;
        await initializeCookies();

        const retryResponse = await client.get(url, {
          params: { term, locale: 'ru_RU' },
          headers: ugHeaders,
        });
        return retryResponse.data;
      } else {
        console.error('Ошибка при выполнении запроса:', axiosError.message);
        throw axiosError;
      }
    } else {
      console.error('Неизвестная ошибка:', error);
      throw error;
    }
  }
};

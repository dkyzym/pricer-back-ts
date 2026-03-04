import axios, { AxiosError } from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import chalk from 'chalk';
import { CookieJar } from 'tough-cookie';
import { ugHeaders } from '../constants/headers.js';

// Переменные модуля
const cookieJar = new CookieJar();
const client = wrapper(axios.create({ jar: cookieJar, withCredentials: true }));
let initializationPromise: Promise<void> | null = null;

/**
 * Singleton Promise для инициализации куки.
 *
 * Идея паттерна:
 * - при первом обращении к API, когда куки ещё не получены, создаётся ОДИН общий промис `initializationPromise`;
 * - все конкурентные вызовы функции `initializeCookies` не создают новые запросы, а просто «подписываются» на этот промис;
 * - это защищает поставщика от лавинообразных параллельных запросов при пустом кэше (одна инициализация — много ожидающих).
 *
 * Почему не обнуляем промис на успех:
 * - успешно выполненный промис отражает текущее «валидное» состояние куки; кэшируем его, чтобы повторно не ходить за тем же самым.
 *
 * Когда обнуляем:
 * - при ошибке (catch ниже) — чтобы следующая попытка могла заново инициализировать куки;
 * - при ответе 400 в `getAutocomplete` — это явный сигнал, что куки протухли, поэтому принудительно сбрасываем промис,
 *   чтобы последующая инициализация запросила свежие куки.
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
 *
 * Перед каждым запросом гарантирует валидное состояние куки через initializeCookies().
 * В случае статуса 400 (протухшие куки) принудительно сбрасывает Singleton Promise
 * и переинициализирует куки, после чего повторяет запрос.
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

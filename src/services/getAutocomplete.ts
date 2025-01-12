import axios, { AxiosError } from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import chalk from 'chalk';
import { CookieJar } from 'tough-cookie';
import { ugHeaders } from '../constants/headers.js';

// Переменные модуля
const cookieJar = new CookieJar();
const client = wrapper(axios.create({ jar: cookieJar, withCredentials: true }));
let cookiesInitialized = false;

// Функция инициализации куки
const initializeCookies = async () => {
  try {
    await client.get('https://ugautopart.ru/', {
      headers: ugHeaders,
    });
    cookiesInitialized = true;
    console.log(chalk.green('Куки Автокомплита ЮГ успешно инициализированы'));
  } catch (error) {
    console.error('Ошибка при инициализации куки:', error);
    throw error; // Пробрасываем ошибку выше
  }
};

// Основная функция
export const getAutocomplete = async (term: string): Promise<any> => {
  const url = `https://ugautopart.ru/ajax/modules2/search.tips/get`;

  // Проверяем, инициализированы ли куки
  if (!cookiesInitialized) {
    await initializeCookies();
  }

  try {
    const response = await client.get(url, {
      params: { term, locale: 'ru_RU' },
      headers: ugHeaders,
    });
    return response.data;
  } catch (error) {
    // Обработка ошибки с типизацией
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;

      // Проверяем статус ошибки
      if (axiosError.response?.status === 400) {
        console.warn(
          'Куки, возможно, истекли. Переинициализируем куки и повторяем запрос.'
        );

        // Переинициализируем куки
        cookiesInitialized = false;
        await initializeCookies();

        // Повторяем запрос
        const retryResponse = await client.get(url, {
          params: { term, locale: 'ru_RU' },
          headers: ugHeaders,
        });
        return retryResponse.data;
      } else {
        console.error('Ошибка при выполнении запроса:', axiosError.message);
        throw axiosError; // Пробрасываем ошибку выше
      }
    } else {
      // Ошибка не связана с Axios
      console.error('Неизвестная ошибка:', error);
      throw error;
    }
  }
};

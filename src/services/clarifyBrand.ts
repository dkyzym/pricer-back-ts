import axios, { AxiosError, AxiosInstance } from 'axios';
import { v4 as uuidv4 } from 'uuid';

import { createAxiosInstance } from './apiClient.js';
import { getItemsListByArticleService } from './profit/getItemsListByArticleService.js';
import { Logger } from 'winston';
import { ItemAutocompleteRow } from '../types/search.types.js';

interface UgBrandData {
  availability: number;
  brand: string;
  description: string;
  number: string;
  numberFix: string;
}

interface ProfitItem {
  availability: number;
  brand: string;
  description: string;
  number: string;
  numberFix: string;
  article: string;
  original: boolean;
  own: boolean;
  supplier: boolean;
  rating: number;
  brand_warranty: string;
  countProducts: number;
}

interface ClarifyBrandResult {
  success: boolean;
  brands: ItemAutocompleteRow[];
  message: string;
}

export const clarifyBrand = async (
  query: string,
  userLogger: Logger
): Promise<ClarifyBrandResult> => {
  // Функция для обработки данных от поставщика 'ug'
  const fetchUgBrands = async (): Promise<ItemAutocompleteRow[]> => {
    const axiosInstance: AxiosInstance = await createAxiosInstance('ug');
    try {
      const response = await axiosInstance.get<{ [key: string]: UgBrandData }>(
        '/search/brands/',
        {
          params: { number: query },
        }
      );

      const data = response.data;
      const ugItems: ItemAutocompleteRow[] = Object.values(data).map(
        (item) => ({
          brand: item.brand,
          number: item.number,
          descr: item.description || '',
          url: ``,
          id: uuidv4(),
        })
      );

      return ugItems;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<{
          errorCode: number;
          errorMessage: string;
        }>;

        // Проверяем, что это ошибка 404 с специфическим кодом ошибки
        if (
          axiosError.response?.status === 404 &&
          axiosError.response.data?.errorCode === 301 &&
          axiosError.response.data.errorMessage === 'No results'
        ) {
          // Это не ошибка, просто нет данных
          return [];
        }
      }

      // В остальных случаях выбрасываем ошибку дальше
      throw error;
    }
  };

  // Функция для обработки данных от поставщика 'profit'
  const fetchProfitItems = async (): Promise<ItemAutocompleteRow[]> => {
    const profitData: ProfitItem[] = await getItemsListByArticleService(query);
    const profitItems: ItemAutocompleteRow[] = profitData.map((item) => ({
      brand: item.brand,
      number: item.article,
      descr: item.description || '',
      url: ``,
      id: uuidv4(),
    }));

    return profitItems;
  };

  // Запускаем оба запроса параллельно и ждем их завершения
  const [ugResult, profitResult] = await Promise.allSettled([
    fetchUgBrands(),
    fetchProfitItems(),
  ]);

  const finalBrands: ItemAutocompleteRow[] = [];
  let success = true;
  const messages: string[] = [];

  // Обрабатываем результат поставщика 'ug'
  if (ugResult.status === 'fulfilled') {
    finalBrands.push(...ugResult.value);
    if (ugResult.value.length === 0) {
      messages.push('Нет данных от поставщика ug.');
    }
  } else {
    success = false;
    userLogger.error(
      'Ошибка при получении данных от поставщика ug:',
      ugResult.reason
    );
    messages.push('Ошибка при получении данных от поставщика ug.');
  }

  // Обрабатываем результат поставщика 'profit'
  if (profitResult.status === 'fulfilled') {
    finalBrands.push(...profitResult.value);
  } else {
    success = false;
    userLogger.error(
      'Ошибка при получении данных от поставщика profit:',
      profitResult.reason
    );
    messages.push('Ошибка при получении данных от поставщика profit.');
  }

  // Если оба запроса успешны
  if (success) {
    if (finalBrands.length > 0) {
      messages.push('Данные успешно получены от обоих поставщиков.');
    } else {
      messages.push(
        'Данные успешно получены, но нет результатов от поставщиков.'
      );
    }
  }

  return {
    success,
    brands: finalBrands,
    message: messages.join(' '),
  };
};

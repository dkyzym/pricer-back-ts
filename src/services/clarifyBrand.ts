import axios, { AxiosError, AxiosInstance } from 'axios';
import { v4 as uuidv4 } from 'uuid';

import { Logger } from 'winston';
import { ItemAutocompleteRow } from '../types/search.types.js';
import { getAxiosInstance } from '../infrastructure/http/apiClient.js';
import { assortmentSearchArmtek } from './armtek/assortmentSearchArmtek.js';
import { getItemsListByArticleService } from './profit/getItemsListByArticleService.js';

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
    const axiosInstance: AxiosInstance = await getAxiosInstance('ug');
    try {
      const response = await axiosInstance.get<{ [key: string]: UgBrandData }>(
        '/search/brands/',
        {
          params: { number: query },
        }
      );

      return Object.values(response.data).map((item) => ({
        brand: item.brand,
        number: item.number,
        descr: item.description || '',
        url: '',
        id: uuidv4(),
      }));
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
    return profitData.map((item) => ({
      brand: item.brand,
      number: item.article,
      descr: item.description || '',
      url: '',
      id: uuidv4(),
    }));
  };

  const fetchArmtekBrands = async (): Promise<ItemAutocompleteRow[]> => {
    const items = await assortmentSearchArmtek(
      { VKORG: '4000', PIN: query, PROGRAM: 'LP' },
      userLogger
    );
    return items.map((item) => ({
      brand: item.BRAND ?? '',
      number: item.PIN ?? '',
      descr: item.NAME ?? '',
      url: '',
      id: uuidv4(),
    }));
  };

  const [ugResult, profitResult, armtekResult] = await Promise.allSettled([
    fetchUgBrands(),
    fetchProfitItems(),
    fetchArmtekBrands(),
  ]);

  const finalBrands: ItemAutocompleteRow[] = [];
  let success = true;
  const messages: string[] = [];

  const suppliers = [
    { name: 'ug', result: ugResult },
    { name: 'profit', result: profitResult },
    { name: 'armtek', result: armtekResult },
  ];

  for (const { name, result } of suppliers) {
    if (result.status === 'fulfilled') {
      finalBrands.push(...result.value);
    } else {
      success = false;
      userLogger.error(
        `Ошибка при получении данных от поставщика ${name}:`,
        result.reason
      );
      messages.push(`Ошибка при получении данных от поставщика ${name}.`);
    }
  }

  const seen = new Set<string>();
  const brandsDeduplicated: ItemAutocompleteRow[] = [];
  for (const row of finalBrands) {
    const key = `${(row.brand ?? '').trim().toLowerCase()}\t${(row.number ?? '').trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    brandsDeduplicated.push(row);
  }

  if (success) {
    if (brandsDeduplicated.length > 0) {
      messages.push('Данные успешно получены от поставщиков.');
    } else {
      messages.push(
        'Данные успешно получены, но нет результатов от поставщиков.'
      );
    }
  }

  return {
    success,
    brands: brandsDeduplicated,
    message: messages.join(' '),
  };
};

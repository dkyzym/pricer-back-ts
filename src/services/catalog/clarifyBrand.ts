import axios, { AxiosError, AxiosInstance } from 'axios';
import { v4 as uuidv4 } from 'uuid';

import { Logger } from 'winston';
import { ClarifyBrandResult } from '../../types/brand.types.js';
import { ItemAutocompleteRow } from '../../types/search.types.js';
import { getAxiosInstance } from '../../infrastructure/http/apiClient.js';
import { assortmentSearchArmtek } from '../suppliers/armtek/assortmentSearchArmtek.js';
import { getItemsListByArticleService } from '../suppliers/profit/getItemsListByArticleService.js';
import { mikanoClient } from '../suppliers/mikano/client.js';
import { autoImpulseClient } from '../suppliers/autoImpulse/client.js';

/** Ответ ABCP Public API GET /search/brands/?number=… (UG, NPN, Patriot и др.) */
interface AbcpBrandByArticleRow {
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

/**
 * Бренды по артикулу через ABCP Public API (тот же контракт, что у UG).
 */
const fetchAbcpBrandsByArticle = async (
  supplierKey: 'ug' | 'npn' | 'patriot',
  article: string
): Promise<ItemAutocompleteRow[]> => {
  const axiosInstance: AxiosInstance = await getAxiosInstance(supplierKey);
  try {
    const response = await axiosInstance.get<{
      [key: string]: AbcpBrandByArticleRow;
    }>('/search/brands/', {
      params: { number: article },
    });

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

      if (
        axiosError.response?.status === 404 &&
        axiosError.response.data?.errorCode === 301 &&
        axiosError.response.data.errorMessage === 'No results'
      ) {
        return [];
      }
    }

    throw error;
  }
};

export const clarifyBrand = async (
  query: string,
  userLogger: Logger
): Promise<ClarifyBrandResult> => {
  const fetchUgBrands = async (): Promise<ItemAutocompleteRow[]> =>
    fetchAbcpBrandsByArticle('ug', query);

  const fetchNpnBrands = async (): Promise<ItemAutocompleteRow[]> =>
    fetchAbcpBrandsByArticle('npn', query);

  const fetchPatriotBrands = async (): Promise<ItemAutocompleteRow[]> =>
    fetchAbcpBrandsByArticle('patriot', query);

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

  const fetchMikanoBrands = async (): Promise<ItemAutocompleteRow[]> =>
    mikanoClient.searchBrands(query);

  const fetchAutoImpulseBrands = async (): Promise<ItemAutocompleteRow[]> =>
    autoImpulseClient.searchBrands(query);

  const [
    ugResult,
    npnResult,
    patriotResult,
    profitResult,
    armtekResult,
    mikanoResult,
    autoImpulseResult,
  ] = await Promise.allSettled([
    fetchUgBrands(),
    fetchNpnBrands(),
    fetchPatriotBrands(),
    fetchProfitItems(),
    fetchArmtekBrands(),
    fetchMikanoBrands(),
    fetchAutoImpulseBrands(),
  ]);

  const finalBrands: ItemAutocompleteRow[] = [];
  const messages: string[] = [];
  const failedSupplierKeys: string[] = [];

  const suppliers = [
    { name: 'ug', result: ugResult },
    { name: 'npn', result: npnResult },
    { name: 'patriot', result: patriotResult },
    { name: 'profit', result: profitResult },
    { name: 'armtek', result: armtekResult },
    { name: 'mikano', result: mikanoResult },
    { name: 'autoImpulse', result: autoImpulseResult },
  ] as const;

  let successful = 0;
  for (const { name, result } of suppliers) {
    if (result.status === 'fulfilled') {
      successful += 1;
      finalBrands.push(...result.value);
    } else {
      failedSupplierKeys.push(name);
      userLogger.error(
        `Ошибка при получении данных от поставщика ${name}:`,
        result.reason
      );
      messages.push(`Ошибка при получении данных от поставщика ${name}.`);
    }
  }

  const supplierStats = {
    total: suppliers.length,
    successful,
    failedSupplierKeys: [...failedSupplierKeys],
  };

  const seen = new Set<string>();
  const brandsDeduplicated: ItemAutocompleteRow[] = [];
  for (const row of finalBrands) {
    const key = `${(row.brand ?? '').trim().toLowerCase()}\t${(row.number ?? '').trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    brandsDeduplicated.push(row);
  }

  if (failedSupplierKeys.length === 0) {
    if (brandsDeduplicated.length > 0) {
      messages.push('Все источники ответили, варианты брендов собраны.');
    } else {
      messages.push(
        'Все источники ответили, совпадений по брендам не найдено.'
      );
    }
  }

  return {
    brands: brandsDeduplicated,
    message: messages.join(' ').trim(),
    supplierStats,
  };
};

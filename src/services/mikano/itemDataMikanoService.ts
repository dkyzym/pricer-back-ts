import { ParallelSearchParams, SearchResultsParsed } from '../../types/search.types.js';
import { mikanoClient } from '../abcp/index.js';

/**
 * Сервис для поиска товаров у поставщика Mikano.
 * Вся сложная логика (авторизация, запросы, парсинг) инкапсулирована в mikanoClient.
 */
export const itemDataMikanoService = async (
  params: ParallelSearchParams
): Promise<SearchResultsParsed[]> => {
  // Просто вызываем метод поиска у нашего готового клиента
  return mikanoClient.searchItem(params);
};


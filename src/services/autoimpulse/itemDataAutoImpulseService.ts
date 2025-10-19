
import { ParallelSearchParams, SearchResultsParsed } from '../../types/search.types.js';
import { autoImpulseClient } from '../abcp_parsed/index.js';

/**
 * Сервис для поиска товаров у поставщика AutoImpulse.
 * Вся сложная логика (авторизация, запросы, парсинг) инкапсулирована в autoImpulseClient.
 */
export const itemDataAutoImpulseService = async (
  params: ParallelSearchParams
): Promise<SearchResultsParsed[]> => {
  // Просто вызываем метод поиска у нашего готового клиента
  return autoImpulseClient.searchItem(params);
};


import { StoreResponseItem } from './armtek.types';
import { getArmtekStoresList } from './getArmtekStoresList.js';

let storeListCache: StoreResponseItem[] = [];
let lastUpdate = 0;

/**
 * Интервал, через который мы хотим обновлять кэш (мс).
 * Допустим, 24 часа = 86400000 мс
 */
const CACHE_TTL = 24 * 60 * 60 * 1000;

export async function getCachedStoreList(): Promise<StoreResponseItem[]> {
  const now = Date.now();

  // Если кэш пустой или устарел
  if (!storeListCache.length || now - lastUpdate > CACHE_TTL) {
    const armtekResponse = await getArmtekStoresList();
    if (armtekResponse && Array.isArray(armtekResponse.RESP)) {
      storeListCache = armtekResponse.RESP;
      lastUpdate = now;
    } else {
      // Если вдруг сервис вернул пустой результат
      storeListCache = [];
    }
  }

  return storeListCache;
}

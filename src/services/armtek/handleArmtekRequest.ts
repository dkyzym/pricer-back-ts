import { isBrandMatch } from '../../utils/data/isBrandMatch';
import { parseArmtekResults } from './parseArmtekResults';
import { searchArmtekArticle } from './searchArmtekArticle';
import { getCachedStoreList } from './storeList';

async function handleArmtekRequest(item: { brand: string; article: string }) {
  // Получаем результат поиска
  const { STATUS, MESSAGES, RESP } = await searchArmtekArticle({
    PIN: item.article,
  });

  if (!RESP) {
    // нет данных
    return [];
  }

  // Фильтр по бренду
  const relevantItems = RESP.filter((r) =>
    isBrandMatch(item.brand, r.BRAND as string)
  );

  // Получаем (из кэша) список складов
  const storeList = await getCachedStoreList();

  // Парсим результаты, передаём список складов
  const parsedArmtekResults = parseArmtekResults(relevantItems, storeList);

  return parsedArmtekResults;
}

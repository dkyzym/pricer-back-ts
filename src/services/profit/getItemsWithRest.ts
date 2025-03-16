import axios from 'axios';
import { itemsGroupProfit } from 'types/index.js';
import { Logger } from 'winston';

export const getItemsWithRest = async (
  items: itemsGroupProfit,
  userLogger: Logger,
  maxRetries: number = 1,
  delayMs: number = 1000
): Promise<any> => {
  const apiKey = process.env.PROFIT_API_KEY;

  if (!apiKey) {
    throw new Error('API key is not defined');
  }

  const uri = `https://api.pr-lg.ru/search/items?secret=${apiKey}&article=${items[0].article}&brand=${items[0].brand}`;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await axios.get(uri);
      return res.data;
    } catch (error) {
      // Логирование ошибки с номером попытки
      userLogger.error(
        `Попытка ${attempt} - ошибка getItemsWithRest: ${(error as Error).message}`
      );

      if (attempt < maxRetries) {
        // Ждем перед следующей попыткой
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        userLogger.error(error);
        return [];
      }
    }
  }
};

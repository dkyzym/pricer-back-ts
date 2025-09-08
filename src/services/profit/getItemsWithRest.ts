import axios, { AxiosError } from 'axios';
import https from 'https';
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

  // Создаем HTTPS агент для игнорирования SSL ошибок
  const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
  });

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await axios.get(uri, {
        httpsAgent,
        timeout: 30000,
      });
      return res.data;
    } catch (error) {
      const axiosError = error as AxiosError;

      userLogger.error(
        `Попытка ${attempt} - ошибка getItemsWithRest: ${axiosError.message}`,
        {
          url: axiosError.config?.url,
          method: axiosError.config?.method,
          status: axiosError.response?.status,
          responseData: axiosError.response?.data,
        }
      );

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        userLogger.error(`All attempts failed for URL: ${uri}`);
        return [];
      }
    }
  }
};

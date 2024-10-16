import axios from 'axios';
import { logger } from 'config/logger';
import { itemsGroupProfit } from 'types';

export const getItemsWithRest = async (items: itemsGroupProfit) => {
  const apiKey = process.env.PROFIT_API_KEY;

  if (!apiKey) {
    throw new Error('API key is not defined');
  }

  try {
    const uri = `https://api.pr-lg.ru/search/items?secret=${apiKey}&article=${items[0].article}&brand=${items[0].brand}`;
    const res = await axios.get(uri);

    return res.data;
  } catch (error) {
    logger.error(`getItemsWithRest ${error}`);
    return [];
  }
};

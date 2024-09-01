import axios from 'axios';

export const getItemsListByArticleService = async (article: string) => {
  const apiKey = process.env.PROFIT_API_KEY;

  const url = `https://api.pr-lg.ru/search/products?secret=${apiKey}&article=${article}`;

  const res = await axios.get(url);

  return res.data;
};

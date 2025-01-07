import { AxiosError, AxiosResponse } from 'axios';
import { US_SERVICE_PATHS } from '../../../config/api/config';
import { logger } from '../../../config/logger';
import { ugArticleSearchResult } from '../../../types';
import { createAxiosInstance } from '../../apiClient';

export const fetchUgData = async (
  article: string,
  brand: string,
  useOnlineStocks?: number,
  withOutAnalogs?: number
) => {
  try {
    const axiosInstance = await createAxiosInstance('ug');
    const brands = await axiosInstance.get('/search/brands/', {
      params: { number: '13-1004062-СБ' },
    });
    logger.info(brands.data);

    // https://api.pr-lg.ru/search/products?secret=7xjfp7Mani6MANWSO9Q973T-TtoBN49Z&article=131004062СБ

    const response: AxiosResponse<ugArticleSearchResult[]> =
      await axiosInstance.get(US_SERVICE_PATHS.Article_search, {
        params: {
          number: article,
          brand,
          useOnlineStocks: 1,
          withOutAnalogs: 1,
        },
      });

    return response.data;
  } catch (error) {
    console.error(
      'Ошибка при получении данных UG:',
      (error as AxiosError).message
    );
    logger.error(error);
    throw error;
  }
};

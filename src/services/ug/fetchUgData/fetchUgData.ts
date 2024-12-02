import { AxiosError, AxiosResponse } from 'axios';
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

    const response: AxiosResponse<ugArticleSearchResult[]> =
      await axiosInstance.get('/search/articles/', {
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
      'Ошибка при получении данных:',
      (error as AxiosError).message
    );
    throw error;
  }
};

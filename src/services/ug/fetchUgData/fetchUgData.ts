import { AxiosError, AxiosResponse } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { SearchResultsParsed, ugArticleSearchResult } from '../../../types';
import { calculateDeliveryDate } from '../../../utils/calculateDates';
import { isBrandMatch } from '../../../utils/data/isBrandMatch';
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

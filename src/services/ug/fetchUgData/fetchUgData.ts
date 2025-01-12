import { AxiosResponse } from 'axios';
import { US_SERVICE_PATHS } from '../../../config/api/config.js';
import { ugArticleSearchResult } from '../../../types/index.js';
import { createAxiosInstance } from '../../apiClient.js';

export const fetchUgData = async (article: string, brand: string) => {
  try {
    const axiosInstance = await createAxiosInstance('ug');

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
    throw error;
  }
};

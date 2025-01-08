import { AxiosResponse } from 'axios';
import { US_SERVICE_PATHS } from '../../../config/api/config';
// import { logger } from '../../../config/logger';
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

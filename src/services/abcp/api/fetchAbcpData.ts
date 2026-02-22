import { AxiosResponse } from 'axios';
import { ABCP_SERVICE_PATHS } from '../../../config/api/config.js';
import { getAxiosInstance } from '../../apiClient/apiClient.js';
import {
  AbcpArticleSearchResult,
  AbcpSupplierAlias,
} from '../abcpPlatform.types.js';

export const fetchAbcpData = async (
  article: string,
  brand: string,
  supplier: AbcpSupplierAlias,
  useOnlineStocks?: number
) => {
  try {
    const axiosInstance = await getAxiosInstance(
      supplier === 'ug_f' ? 'ug' : supplier
    );

    const params = {
      number: article,
      brand,
      useOnlineStocks:
        supplier === 'patriot' || supplier === 'npn' ? 0 : useOnlineStocks,
      withOutAnalogs: 1,
    };

    const response: AxiosResponse<AbcpArticleSearchResult[]> =
      await axiosInstance.get(ABCP_SERVICE_PATHS.Article_search, {
        params: params,
      });

    return response.data;
  } catch (error) {
    throw error;
  }
};

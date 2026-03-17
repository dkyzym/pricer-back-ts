import { AxiosResponse } from 'axios';
import { ABCP_SERVICE_PATHS } from '../../../../config/api/config.js';
import { getAxiosInstance } from '../../../../infrastructure/http/apiClient.js';
import {
  AbcpOrdersResponse,
  AbcpSupplierAlias,
  FetchOrdersParams,
} from '../abcpPlatform.types.js';

const formatDateForAbcp = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
};

export const fetchAbcpOrders = async (
  supplier: AbcpSupplierAlias,
  queryParams: FetchOrdersParams = {},
  targetSyncDate?: Date,
  signal?: AbortSignal
): Promise<AbcpOrdersResponse> => {
  const axiosInstance = await getAxiosInstance(supplier);

  const params = {
    limit: queryParams.limit ?? 200,
    skip: queryParams.skip ?? 0,
    ...(queryParams.format ? { format: queryParams.format } : {}),
    ...(targetSyncDate ? { dateStart: formatDateForAbcp(targetSyncDate) } : {}),
    ...(queryParams.dateEnd ? { dateEnd: queryParams.dateEnd } : {}),
  };

  const response: AxiosResponse<AbcpOrdersResponse> = await axiosInstance.get(
    ABCP_SERVICE_PATHS.Orders,
    {
      params,
      timeout: 60_000,
      signal,
    }
  );

  return response.data;
};

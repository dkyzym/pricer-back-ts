import { AxiosResponse } from 'axios';
import { ABCP_SERVICE_PATHS } from '../../../config/api/config.js';
import { getAxiosInstance } from '../../apiClient/apiClient.js';
import {
  AbcpOrdersResponse,
  AbcpSupplierAlias,
  FetchOrdersParams,
} from '../abcpPlatform.types.js';

export const fetchAbcpOrders = async (
  supplier: AbcpSupplierAlias,
  queryParams: FetchOrdersParams = {}
): Promise<AbcpOrdersResponse> => {
  try {
    const axiosInstance = await getAxiosInstance(supplier);

    const params = {
      limit: queryParams.limit ?? 200,
      skip: queryParams.skip ?? 0,
      ...(queryParams.format ? { format: queryParams.format } : {}),
    };

    const response: AxiosResponse<AbcpOrdersResponse> = await axiosInstance.get(
      ABCP_SERVICE_PATHS.Orders,
      {
        params,
        timeout: 60_000,
      }
    );

    return response.data;
  } catch (error) {
    throw error;
  }
};

export const fetchAbcpStatuses = async (
  supplier: AbcpSupplierAlias
): Promise<AbcpOrdersResponse> => {
  try {
    const axiosInstance = await getAxiosInstance(supplier);

    const response: AxiosResponse<AbcpOrdersResponse> = await axiosInstance.get(
      ABCP_SERVICE_PATHS.Statuses,
      {
        timeout: 60_000,
      }
    );

    return response.data;
  } catch (error) {
    throw error;
  }
};

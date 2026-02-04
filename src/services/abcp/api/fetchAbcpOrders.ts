import { AxiosResponse } from 'axios';
import { ABCP_SERVICE_PATHS } from '../../../config/api/config.js';
import { createAxiosInstance } from '../../apiClient/apiClient.js';
import {
  AbcpOrdersResponse,
  AbcpSupplierAlias,
  FetchOrdersParams,
} from '../abcpPlatform.types.js';

export const fetchAbcpOrders = async (
  supplier: AbcpSupplierAlias, // Например 'ug' или 'patriot'
  queryParams: FetchOrdersParams = {}
): Promise<AbcpOrdersResponse> => {
  try {
    // 1. Создаем инстанс.
    // Внутри apiClient сработает магия:
    // - Найдется конфиг для 'ug'
    // - Поднимется прокси (если надо)
    // - В интерсепторе добавятся userlogin и md5(userpsw)
    const axiosInstance = await createAxiosInstance(supplier);

    // 2. Формируем параметры (limit, skip, format)
    // Логин и пароль тут НЕ указываем, они добавятся сами!
    const params = {
      limit: queryParams.limit ?? 100,
      skip: queryParams.skip ?? 0,
      ...(queryParams.format ? { format: queryParams.format } : {}),
    };

    // 3. Делаем запрос
    const response: AxiosResponse<AbcpOrdersResponse> = await axiosInstance.get(
      ABCP_SERVICE_PATHS.Orders,
      {
        params: params,
      }
    );

    return response.data;
  } catch (error) {
    // Тут можно добавить логирование ошибки через userLogger, если нужно
    throw error;
  }
};

export const fetchAbcpStatuses = async (
  supplier: AbcpSupplierAlias
): Promise<AbcpOrdersResponse> => {
  try {
    const axiosInstance = await createAxiosInstance(supplier);

    const response: AxiosResponse<AbcpOrdersResponse> = await axiosInstance.get(
      ABCP_SERVICE_PATHS.Statuses
    );

    return response.data;
  } catch (error) {
    throw error;
  }
};

import { AxiosError } from 'axios';
import { TURBOCARS_SERVICE_PATHS } from '../../../config/api/config';
import { createAxiosInstance } from '../../apiClient';

export const searchTurbocarsCode = async (searchCode: string) => {
  try {
    const api = await createAxiosInstance('turboCars');

    const response = await api.get(TURBOCARS_SERVICE_PATHS.Code_search, {
      params: {
        Search_Code: searchCode,
      },
      // We expect XML, ensure responseType is 'text' to get raw XML
      responseType: 'json',
    });

    return response.data;
  } catch (error) {
    console.error(
      'Ошибка при получении данных TurboCars:',
      (error as AxiosError).message
    );
    throw error;
  }
};

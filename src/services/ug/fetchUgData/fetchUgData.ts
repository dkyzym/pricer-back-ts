import { AxiosError } from 'axios';
import { createAxiosInstance } from '../../apiClient';

export const fetchUgData = async (
  article: string,
  brand: string,
  useOnlineStocks?: 0,
  withOutAnalogs?: 0
) => {
  try {
    const axiosInstance = await createAxiosInstance('ug');

    const response = await axiosInstance.get('/search/articles/', {
      params: {
        number: article,
        brand,
        useOnlineStocks,
        withOutAnalogs,
      },
    });

    console.log(response.data?.length);
    console.log(response.data[0]);

    return response.data;
  } catch (error) {
    console.error(
      'Ошибка при получении данных:',
      (error as AxiosError).message
    );
  }
};

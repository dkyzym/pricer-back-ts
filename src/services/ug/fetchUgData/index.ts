import { createAxiosInstance } from '../../apiClient';

export const fetchUgData = async (article: string, useOnlineStocks?: 0) => {
  try {
    const axiosInstance = createAxiosInstance('ug');

    const response = await axiosInstance.get('/search/brands/', {
      params: {
        number: article,
        useOnlineStocks,
      },
    });

    console.log(response.data);

    return response.data;
  } catch (error) {
    console.error('Ошибка при получении данных:', (error as Error).message);
  }
};

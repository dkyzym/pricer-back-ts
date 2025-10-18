import { AxiosError, AxiosResponse } from 'axios';
import { BasketPositionUG, UgCartResponse } from '../../../types/index.js';
import { createAxiosInstance } from '../../apiClient.js';

export const removeFromCartUgService = async (
  positions: BasketPositionUG[]
): Promise<UgCartResponse> => {
  try {
    const axiosInstance = await createAxiosInstance('armtek');
    const params = new URLSearchParams();

    positions.forEach((position, index) => {
      const prefix = `positions[${index}]`;
      params.append(`${prefix}[number]`, position.number);
      params.append(`${prefix}[brand]`, position.brand);
      params.append(`${prefix}[supplierCode]`, position.supplierCode);
      params.append(`${prefix}[itemKey]`, position.itemKey);
      params.append(`${prefix}[quantity]`, '0'); // Устанавливаем quantity = 0 для удаления
    });

    const response: AxiosResponse<UgCartResponse> = await axiosInstance.post(
      '/basket/add',
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError;
    console.error('Ошибка при удалении из корзины:', axiosError.message);
    throw axiosError;
  }
};

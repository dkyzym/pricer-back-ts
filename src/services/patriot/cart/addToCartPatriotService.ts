import { AxiosError, AxiosResponse } from 'axios';

import { BasketPositionUG, UgCartResponse } from '../../../types/index.js';
import { createAxiosInstance } from '../../apiClient.js';
import { removeFromCartUgService } from './removeFromCartPatriotService.js';

export const addToCartPatriotService = async (
  positions: BasketPositionUG[]
): Promise<UgCartResponse> => {
  try {
    const axiosInstance = await createAxiosInstance('patriot');
    const params = new URLSearchParams();

    positions.forEach((position, index) => {
      const prefix = `positions[${index}]`;
      params.append(`${prefix}[number]`, position.number);
      params.append(`${prefix}[brand]`, position.brand);
      params.append(`${prefix}[supplierCode]`, position.supplierCode);
      params.append(`${prefix}[itemKey]`, position.itemKey);
      params.append(`${prefix}[quantity]`, position.quantity.toString());
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

    if (
      response.data.status === 0 &&
      response.data.errorMessage ===
        'Такой товар уже есть в корзине с этого online поставщика'
    ) {
      console.warn('Товар уже в корзине. Пытаемся обновить количество.');

      // Удаляем существующий товар
      await removeFromCartUgService(positions);

      // Повторно добавляем товар с новым количеством
      const retryResponse: AxiosResponse<UgCartResponse> =
        await axiosInstance.post('/basket/add', params.toString(), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });

      return retryResponse.data;
    }

    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError;
    console.error('Ошибка при добавлении в корзину:', axiosError.message);
    throw axiosError;
  }
};

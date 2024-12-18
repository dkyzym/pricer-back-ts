import { AxiosError, AxiosResponse } from 'axios';

import { BasketPositionUG } from '../../../types';
import { createAxiosInstance } from '../../apiClient';

interface AddToCartResponse {
  status: 1 | 0;
  errorMessage?: string;
  positions: [
    {
      number: string;
      brand: string;
      supplierCode: string;
      quantity: string;
      numberFix: string;
      deadline: number;
      deadlineMax: number;
      description: string;
      status: 1 | 0;
      errorMessage?: string;
    },
  ];
}

export const addToCartUgService = async (
  positions: BasketPositionUG[]
): Promise<AddToCartResponse> => {
  try {
    const axiosInstance = await createAxiosInstance('ug');

    const params = new URLSearchParams();

    positions.forEach((position, index) => {
      const prefix = `positions[${index}]`;

      params.append(`${prefix}[number]`, position.number);
      params.append(`${prefix}[brand]`, position.brand);
      params.append(`${prefix}[supplierCode]`, position.supplierCode);
      params.append(`${prefix}[itemKey]`, position.itemKey);
      params.append(`${prefix}[quantity]`, position.quantity.toString());
    });

    const response: AxiosResponse<AddToCartResponse> = await axiosInstance.post(
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
    console.error('Ошибка при добавлении в корзину:', axiosError.message);
    throw axiosError;
  }
};

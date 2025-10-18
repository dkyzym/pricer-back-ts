import axios from 'axios';
import { ArmtekSearchResponse, StoreResponseItem } from './armtek.types';

/**
 * Функция для получения списка складов.
 * Выполняет POST-запрос к сервису Armtek для получения списка складов.
 *
 * @returns Promise<GetStoresListResponse | undefined> - данные ответа или undefined в случае ошибки.
 */
export async function getArmtekStoresList(): Promise<
  ArmtekSearchResponse<StoreResponseItem> | undefined
> {
  // Формируем данные для отправки в формате form-data
  const formData = new URLSearchParams();
  formData.append('VKORG', '4000');

  try {
    const response = await axios.post<ArmtekSearchResponse<StoreResponseItem>>(
      'http://ws.armtek.by/api/ws_user/getStoreList?format=json',
      formData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        // Basic Authentication: логин и пароль передаются через HTTP Basic Auth
        auth: {
          username: process.env.ARMTEK_USERNAME || '',
          password: process.env.ARMTEK_PASSWORD || '',
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error('Ошибка при выполнении запроса к getStoreList:', error);
    return undefined;
  }
}

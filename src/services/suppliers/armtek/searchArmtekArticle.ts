import axios, { AxiosError } from 'axios';

import { Logger } from 'winston';
import { ArmtekSearchResponse, SearchRequest, SearchResponseItem } from './armtek.types.js';

/**
 * Функция для поиска артикула на сервисе Armtek.
 *
 * @param params - объект с параметрами поиска
 * @returns Промис с результатом (ArmtekSearchResponse)
 * @throws Выбрасывает ошибку, если запрос завершился неудачно
 */
export async function searchArmtekArticle(
  params: SearchRequest,
  userLogger: Logger
): Promise<ArmtekSearchResponse<SearchResponseItem>> {
  // Дефолтные значения
  const {
    VKORG = '4000',
    KUNNR_RG = '43054443',
    PIN,
    BRAND = '',
    QUERY_TYPE = '1',
    PROGRAM = 'LP',
    KUNNR_ZA = '',
    INCOTERMS = '',
    VBELN = '',
  } = params;

  const formData = new URLSearchParams({
    VKORG,
    KUNNR_RG,
    PIN,
    BRAND,
    QUERY_TYPE,
    PROGRAM,
    KUNNR_ZA,
    INCOTERMS,
    VBELN,
  });

  try {
    const response = await axios.post<ArmtekSearchResponse<SearchResponseItem>>(
      'http://ws.armtek.by/api/ws_search/search?format=json',
      formData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        auth: {
          username: process.env.ARMTEK_USERNAME || '',
          password: process.env.ARMTEK_PASSWORD || '',
        },
      }
    );

    return response.data;
  } catch (error: unknown) {
    if (error instanceof AxiosError) {
      userLogger.error('Axios Error:', error.message);
      if (error.response) {
        userLogger.error('Response status:', error.response.status);

        userLogger.error('Response data:', error.response.data);
      }
    } else {
      userLogger.error('Unknown Error:', error);
    }
    // Выбрасываем ошибку выше
    throw new Error('Ошибка при выполнении запроса к Armtek');
  }
}

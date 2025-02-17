import axios, { AxiosError } from 'axios';

/**
 * Тип сообщения.
 * A - критическая ошибка
 * E - ошибка
 * S - успешное сообщение
 * W - предупреждение
 * I - информационное сообщение
 */
export type MessageType = 'A' | 'E' | 'S' | 'W' | 'I';

/**
 * Структура одного сообщения в поле MESSAGES
 */
export interface WebServiceMessage {
  TYPE: MessageType;
  TEXT: string;
  DATE?: string; // Дата сообщения, если приходит
}

/**
 * Элемент результата поиска (внутри `RESP.ARRAY`)
 */
export interface SearchResponseItem {
  PIN?: string;
  BRAND?: string;
  NAME?: string;
  ARTID?: string;
  PARNR?: string;
  KEYZAK?: string;
  RVALUE?: string;
  RETDAYS?: number;
  RDPRF?: string;
  MINBM?: string;
  VENSL?: string;
  PRICE?: string;
  WAERS?: string;
  DLVDT?: string;
  WRNTDT?: string;
  ANALOG?: string;
}

/**
 * Тело ответа при поиске (обычно внутри поля RESP)
 */
export interface SearchResponseBody {
  ARRAY?: SearchResponseItem[];
}

/**
 * Общая структура ответа веб-сервиса (ver. 1.1.7)
 * - STATUS: код ответа
 * - MESSAGES: массив сообщений
 * - RESP: «тело» ответа (здесь в виде объекта с ключом ARRAY)
 */
export interface ArmtekSearchResponse {
  STATUS: number; // Например, 200, 400, 500 и т.д.
  MESSAGES?: WebServiceMessage[]; // Список сообщений
  RESP?: SearchResponseBody; // Тело ответа: { ARRAY?: ... }
}

/**
 * Интерфейс входных параметров для поиска артикула.
 * (Поле PIN оставлено обязательным, т.к. оно действительно критично)
 */
export interface SearchRequest {
  VKORG?: string;
  KUNNR_RG?: string;
  PIN: string; // Номер артикула (ПИН)
  BRAND?: string;
  QUERY_TYPE?: string;
  PROGRAM?: string;
  KUNNR_ZA?: string;
  INCOTERMS?: string;
  VBELN?: string;
}

/**
 * Функция для поиска артикула на сервисе Armtek.
 *
 * @param params - объект с параметрами поиска
 * @returns Промис с результатом (ArmtekSearchResponse)
 * @throws Выбрасывает ошибку, если запрос завершился неудачно
 */
export async function searchArmtekArticle(
  params: SearchRequest
): Promise<ArmtekSearchResponse> {
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
    const response = await axios.post<ArmtekSearchResponse>(
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

    // Возвращаем данные, если запрос прошел успешно
    return response.data;
  } catch (error: unknown) {
    if (error instanceof AxiosError) {
      console.error('Axios Error:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
    } else {
      console.error('Unknown Error:', error);
    }
    // Выбрасываем ошибку выше
    throw new Error('Ошибка при выполнении запроса к Armtek');
  }
}

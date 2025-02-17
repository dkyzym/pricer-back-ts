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

// /**
//  * Тело ответа при поиске (обычно внутри поля RESP)
//  */
// export interface SearchResponseBody {
//   ARRAY?: SearchResponseItem[];
// }

/**
 * Общая структура ответа веб-сервиса (ver. 1.1.7)
 * - STATUS: код ответа
 * - MESSAGES: массив сообщений
 * - RESP: «тело» ответа (здесь в виде объекта с ключом ARRAY)
 */
export interface ArmtekSearchResponse {
  STATUS: number; // Например, 200, 400, 500 и т.д.
  MESSAGES?: WebServiceMessage[]; // Список сообщений
  RESP?: SearchResponseItem[]; // Тело ответа: { ARRAY?: ... }
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

/**
 * Общая структура ответа веб-сервиса (ver. 1.1.7)
 * - STATUS: код ответа
 * - MESSAGES: массив сообщений
 * - RESP: «тело» ответа (здесь в виде объекта с ключом ARRAY)
 */
export interface ArmtekSearchResponse {
  STATUS: number;
  /**
   * Тип сообщения.
   * A - критическая ошибка
   * E - ошибка
   * S - успешное сообщение
   * W - предупреждение
   * I - информационное сообщение
   */
  MESSAGES?: {
    TYPE: 'A' | 'E' | 'S' | 'W' | 'I';
    TEXT: string;
    DATE?: string;
  }[];
  RESP?: SearchResponseItem[];
}

/**
 * Интерфейс элемента результата поиска.
 *
 * @property PIN - Номер артикула (строка, макс. длина <40).
 * @property BRAND - Бренд (строка, макс. длина <18).
 * @property NAME - Наименование (строка, макс. длина 100).
 * @property ARTID - Уникальный идентификационный номер (строка, макс. длина 20).
 * @property PARNR - Код склада партнера (строка, макс. длина 20).
 * @property KEYZAK - Код склада (строка, макс. длина 10). Рекомендуется указывать, т.к. если не указан, поиск производится только по основному складу.
 * @property RVALUE - Доступное количество (строка, макс. длина 20).
 * @property RETDAYS - Количество дней на возврат (число, макс. длина 4).
 * @property RDPRF - Кратность (строка, макс. длина 10).
 * @property MINBM - Минимальное количество (строка, макс. длина 10).
 * @property VENSL - Вероятность поставки (строка, макс. длина 10).
 * @property PRICE - Цена (строка, макс. длина 20).
 * @property WAERS - Валюта (строка, макс. длина 4).
 * @property DLVDT - Дата поставки (строка, макс. длина 20, формат YYYYMMDDHHIISS).
 * @property WRNTDT - Дата гарантированной поставки (строка, макс. длина 20, формат YYYYMMDDHHIISS).
 * @property ANALOG - Признак аналога (строка, макс. длина 1).
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

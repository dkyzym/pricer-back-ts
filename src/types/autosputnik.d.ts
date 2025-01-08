interface AddToCardAutosputnik {
  /**
   * Информация о запросе.
   */
  requestInfo: {
    /**
     * Статус запроса.
     * Возможные значения:
     * - 'ok' — запрос выполнен успешно
     * - 'err' — произошла ошибка при выполнении запроса
     */
    Status: 'ok' | 'err';

    /**
     * Идентификатор пользователя в системе Autosputnik, выполнившего запрос.
     */
    CustomerID: string;

    /**
     * Лимит API (опционально, если присутствует в ответе).
     */
    api_limit?: string;

    /**
     * Признак ошибки.
     * Возможные значения:
     * - 'no' — запрос выполнен без ошибок
     * - 'yes' — произошла ошибка
     */
    Error: 'no' | 'yes';

    /**
     * Описание ошибки, если она есть.
     */
    ErrorDescript: string;
  };

  /**
   * Ответ на запрос добавления товара в корзину.
   */
  requestAnswer: {
    /**
     * Статус добавления товара.
     * Возможные значения:
     * - 'ok' — товар успешно добавлен
     * - 'err' — произошла ошибка при добавлении товара
     */
    added: 'ok' | 'err';

    /**
     * Идентификатор строки в корзине.
     * В случае успешного добавления возвращает строку ID, в случае ошибки — 0.
     */
    valid: string | number;

    /**
     * Дополнительная информация о результате добавления.
     */
    info: string;
  };
}

// AddToCardAutosputnik.ts

/**
 * Интерфейс для раздела requestInfo в ответе API.
 */
interface RequestInfo {
  /**
   * Статус запроса.
   * Возможные значения:
   * - 'ok' — запрос выполнен успешно.
   * - 'err' — произошла ошибка при выполнении запроса.
   */
  Status: 'ok' | 'err';

  /**
   * Идентификатор пользователя в системе Autosputnik, выполнившего запрос.
   */
  CustomerID: string;

  /**
   * Лимит API (опционально, если присутствует в ответе).
   */
  api_limit?: string;

  /**
   * Признак ошибки.
   * Возможные значения:
   * - 'no' — запрос выполнен без ошибок.
   * - 'yes' — произошла ошибка.
   */
  Error: 'no' | 'yes';

  /**
   * Описание ошибки, если она есть.
   */
  ErrorDescript: string;
}

/**
 * Тип для строки заказа в requestAnswer.
 * Каждый элемент массива соответствует определённому полю строки заказа.
 */
type OrderLine = [
  customers_basket_date_added: string, // Дата заказа в формате YYYY-m-d H:i:s, пример: '2016-12-01 14:49:10'
  pre_currency: string, // Валюта пользователя
  pre_price: number, // Цена за единицу товара
  customers_basket_quantity: number, // Количество товара
  final_price: number, // Сумма итого по строке заказа
  id_shop_prices: string, // ИД поставщика в системе Autosputnik
  bra_id: string, // ИД производителя в системе Autosputnik
  bra_brand: string, // Наименование производителя
  articul: string, // Артикул товара
  product_name: string, // Наименование товара
  customers_basket_id: string, // ИД строки корзины для заказа по строке
];

/**
 * Основной интерфейс AddToCardAutosputnik, описывающий структуру ответа API.
 */
export interface CartContentAutosputnik {
  /**
   * Информация о запросе.
   */
  requestInfo: RequestInfo;

  /**
   * Массив строк заказа.
   * Каждая строка представлена массивом с фиксированными индексами.
   */
  requestAnswer: OrderLine[];
}

interface addToCartAutosputnikData {
  /** ID Бренда по автоспутник у нас по ключу autosputnik.brand */
  brand: string;

  /** ВНИМАНИЕ! Не Article */
  articul: string;

  //** ID Склада по autosputnik.id_shop_prices */
  id_shop_prices: string;

  amount: string;
  price: string;
}

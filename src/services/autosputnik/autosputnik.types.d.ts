// interface AddToCardAutosputnik {
//   /**
//    * Информация о запросе.
//    */
//   requestInfo: {
//     /**
//      * Статус запроса.
//      * Возможные значения:
//      * - 'ok' — запрос выполнен успешно
//      * - 'err' — произошла ошибка при выполнении запроса
//      */
//     Status: 'ok' | 'err';

//     /**
//      * Идентификатор пользователя в системе Autosputnik, выполнившего запрос.
//      */
//     CustomerID: string;

//     /**
//      * Лимит API (опционально, если присутствует в ответе).
//      */
//     api_limit?: string;

//     /**
//      * Признак ошибки.
//      * Возможные значения:
//      * - 'no' — запрос выполнен без ошибок
//      * - 'yes' — произошла ошибка
//      */
//     Error: 'no' | 'yes';

//     /**
//      * Описание ошибки, если она есть.
//      */
//     ErrorDescript: string;
//   };

//   /**
//    * Ответ на запрос добавления товара в корзину.
//    */
//   requestAnswer: {
//     /**
//      * Статус добавления товара.
//      * Возможные значения:
//      * - 'ok' — товар успешно добавлен
//      * - 'err' — произошла ошибка при добавлении товара
//      */
//     added: 'ok' | 'err';

//     /**
//      * Идентификатор строки в корзине.
//      * В случае успешного добавления возвращает строку ID, в случае ошибки — 0.
//      */
//     valid: string | number;

//     /**
//      * Дополнительная информация о результате добавления.
//      */
//     info: string;
//   };
// }

// /**
//  * Интерфейс для раздела requestInfo в ответе API.
//  */
// interface RequestInfo {
//   /**
//    * Статус запроса.
//    * Возможные значения:
//    * - 'ok' — запрос выполнен успешно.
//    * - 'err' — произошла ошибка при выполнении запроса.
//    */
//   Status: 'ok' | 'err';

//   /**
//    * Идентификатор пользователя в системе Autosputnik, выполнившего запрос.
//    */
//   CustomerID: string;

//   /**
//    * Лимит API (опционально, если присутствует в ответе).
//    */
//   api_limit?: string;

//   /**
//    * Признак ошибки.
//    * Возможные значения:
//    * - 'no' — запрос выполнен без ошибок.
//    * - 'yes' — произошла ошибка.
//    */
//   Error: 'no' | 'yes';

//   /**
//    * Описание ошибки, если она есть.
//    */
//   ErrorDescript: string;
// }

// /**
//  * Тип для строки заказа в requestAnswer.
//  * Каждый элемент массива соответствует определённому полю строки заказа.
//  */
// type OrderLine = [
//   customers_basket_date_added: string, // Дата заказа в формате YYYY-m-d H:i:s, пример: '2016-12-01 14:49:10'
//   pre_currency: string, // Валюта пользователя
//   pre_price: number, // Цена за единицу товара
//   customers_basket_quantity: number, // Количество товара
//   final_price: number, // Сумма итого по строке заказа
//   id_shop_prices: string, // ИД поставщика в системе Autosputnik
//   bra_id: string, // ИД производителя в системе Autosputnik
//   bra_brand: string, // Наименование производителя
//   articul: string, // Артикул товара
//   product_name: string, // Наименование товара
//   customers_basket_id: string, // ИД строки корзины для заказа по строке
// ];

// /**
//  * Основной интерфейс AddToCardAutosputnik, описывающий структуру ответа API.
//  */
// export interface CartContentAutosputnik {
//   /**
//    * Информация о запросе.
//    */
//   requestInfo: RequestInfo;

//   /**
//    * Массив строк заказа.
//    * Каждая строка представлена массивом с фиксированными индексами.
//    */
//   requestAnswer: OrderLine[];
// }

// interface addToCartAutosputnikData {
//   /** ID Бренда по автоспутник у нас по ключу autosputnik.brand */
//   brand: string;

//   /** ВНИМАНИЕ! Не Article */
//   articul: string;

//   //** ID Склада по autosputnik.id_shop_prices */
//   id_shop_prices: string;

//   amount: string;
//   price: string;
// }

// export interface TovarAutosputnik {
//   /** Идентификатор группы номенклатуры */
//   id_nom_groups: string;
//   /** Название группы номенклатуры */
//   name_nom_groups: string;
//   /** Возможность возврата товара (0 - невозможно вернуть, 1 - возможно) */
//   RETURNS_POSIBL: string;
//   /** NW (необходимо уточнить назначение) */
//   NW: string;
//   /** Цена за единицу товара в валюте пользователя, выполняющего запрос */
//   NEW_COST: string;
//   /** Дата доставки товара с учетом выходных дней (МСК сервер) */
//   DAYOFF2: string;
//   /** Количество календарных дней доставки товара до точки выдачи */
//   DAYOFF3: string;
//   /** Количество рабочих дней доставки товара до точки выдачи */
//   DAYOFF: string;
//   /** Возможная задержка в сроке поставки (максимальный срок поставки) */
//   N_DELTA: string;
//   /** ИД производителя в системе компании Автоспутник */
//   BRA_ID: string;
//   /** Название товара в системе Автоспутник */
//   NAME_TOVAR: string;
//   /** Наличие товара на складе */
//   STOCK: string;
//   /** Артикул, запрошенный пользователем */
//   ARTICUL: string;
//   /** Расшифровка производителя по ИД */
//   BRA_BRAND: string;
//   /** Код склада поставщика */
//   ID_SHOP_PRICES: string;
//   /** Кратность для заказа */
//   CRATN: string;
//   /** Минимальное число товара, которое можно заказать */
//   MINIMAL: string;
//   /** Признак собственного склада компании (1 - свой, 0 - сторонний прайс) */
//   F1C: string;
//   /** Название склада компании (иное - сторонний прайс) */
//   PRICE_NAME: string;
//   /** Вероятность поставки в срок. В процентах (0 - нет заказов по поставщику) */
//   SHIPPING_PROC: string;
// }

// services/autosputnik/autosputnik.types.ts

// Ответ на логин
export interface AutosputnikAuthResponse {
  error: string | null;
  token: string | null;
  userid: number;
}

// Объект Бренда внутри ответов
export interface AutosputnikBrandObj {
  id: number;
  name: string;
}

// Элемент массива из getbrands (список брендов)
export interface AutosputnikBrandItem {
  articul: string;
  brand: AutosputnikBrandObj;
  name: string;
  countproduct: number;
}

// Ответ getbrands
export interface AutosputnikGetBrandsResponse {
  error: string | null;
  data: AutosputnikBrandItem[];
}

// Элемент массива из getproducts (конечный товар)
export interface AutosputnikProductItem {
  articul: string; // Артикул
  articul_search: string;
  brand: AutosputnikBrandObj; // Объект бренда
  name: string; // Наименование
  quantity: number; // Остаток
  price: number; // Цена
  delivery_day: number; // Дней доставки
  price_name: string | null; // Склад
  delivery_date: string; // ISO дата "2025-12-08T06:49:05.911Z"
  our: boolean;
  analog: boolean;
  id_shop_prices: number; // ID склада
  unit: string | null;
  min: number;
  cratnost: number; // Кратность
  vozvrat: boolean; // Возврат
  official_diler: boolean;
  ismark: boolean;
}

// Ответ getproducts
export interface AutosputnikGetProductsResponse {
  error: string | null;
  data: AutosputnikProductItem[];
}

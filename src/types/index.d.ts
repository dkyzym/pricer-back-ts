export type SupplierName =
  | 'turboCars'
  | 'ug'
  | 'patriot'
  | 'profit'
  | 'autosputnik'
  | 'autoImpulse';

export type PuppeteerSupplierName = 'patriot';

export interface Selectors {
  loginForm: string;
  credentialsEl: string;
  emailUsernameField: string;
  passwordField: string;
  loginBtn: string;
  logoutBtn: string;
  input: string;
  [key: string]: string | undefined;
}

interface SupplierData {
  credentials: string;
  cookieName: string;
  loginURL: string;
  logoutURL: string;
  deepSearchURL?: string;
  dashboardURL?: string;
  selectors: Selectors;
}

export type SuppliersData = {
  [key in SupplierName]: SupplierData;
};

export interface SessionData {
  cookies: any[];
  localStorage: { [key: string]: string };
  sessionStorage: { [key: string]: string };
}

type PageAction =
  | {
      action: 'login';
      sessionID: string;
      supplier: SupplierName;
      username: string;
      password: string;
      accountAlias?: accountAlias;
    }
  | {
      action: 'logout';
      sessionID: string;
      supplier: SupplierName;
      accountAlias?: accountAlias;
    }
  | {
      action: 'autocomplete';
      sessionID: string;
      supplier: SupplierName;
      query: string;
      accountAlias?: accountAlias;
    }
  | {
      action: 'clarifyBrand';
      query: string;
    }
  | {
      action: 'addToCart';
      sessionID: string;
      supplier: SupplierName;
      item: SearchResultsParsed;
      count: number;
      accountAlias?: accountAlias;
    }
  | {
      action: 'pick';
      sessionID: string;
      supplier: SupplierName;
      item: ItemToParallelSearch;
      accountAlias?: accountAlias;
    };

interface LoginServiceParams {
  page: Page;
  username: string;
  password: string;
  supplier: SupplierName;
}

export interface ItemToParallelSearch {
  id: string;
  brand: string;
  article: string;
  description: string;
  dataUrl: string;
}

interface ParallelSearchParams {
  page?: Page;
  item: ItemToParallelSearch;
  supplier: SupplierName;
}

export interface SearchResultsParsed {
  id: string;
  article: string;
  brand: string;
  description: string;
  availability: number | string;
  price: number;
  warehouse: string;
  imageUrl: string;
  deadline: number;
  deadLineMax: number;
  supplier: SupplierName;
  probability: number | '';
  needToCheckBrand?: boolean;
  innerId?: string;
  deadLineTimeToOrder?: string;
  deliveryDate?: string;
  returnable?: number;
  multi?: number;
  allow_return?: string;
  warehouse_id?: string;
  inner_product_code?: string;

  //** Свойства для Автоспутник*/
  autosputnik?: {
    brand: string; // id бренда по в системе BRA_ID
    id_shop_prices: string;
  };

  //** Свойства для TurboCars*/
  turboCars?: {
    stock_id: string;
    zakazCode: string;
    nal?: boolean;
  };

  //** Свойства для TurboCars*/
  ug?: {
    //**itemKey Для добавления товара в корзину.*/
    itemKey: string;
    //** supplierCode Для добавления товара в корзину.   */
    supplierCode: string;
  };

  // //** Дополнительное свойство */
  // [key: string]: any; // 'any' дополнительное свойство
}

export interface pageActionsResult {
  success: boolean;
  message: string;
  data?: ItemToParallelSearch[] | SearchResultsParsed[];
}

export interface itemI {
  article: string;
  brand: string;
}

export type itemsGroupProfit = itemI[];

interface ProductProfit {
  donkey: string;
  warehouse_id: string;
  brand_id: number;
  brand: string;
  article: string;
  product_code: string;
  multi: number;
  quantity: string;
  price: number;
  returnable: number;
  description: string;
  article_id: string;
  return_days: number;
  brand_info: boolean;
  brand_warranty: boolean;
  original: boolean;
  waitings: number;
  custom_warehouse_name: string;
  show_date: string;
  delivery_time: number;
  allow_return: string;
  delivery_date: string;
  delivery_probability: number;
  imageUrl?: string;
  supplier?: SupplierName;
}

export interface ApiResponseItem {
  id: string;
  article: string;
  description: string;
  brand: string;
  original: string;
  brand_warranty: string;
  products: {
    [key: string]: Product;
  };
}

export interface SearchResult {
  supplier: SupplierName;
  result: pageActionsResult | null;
}

export interface SupplierConfig {
  supplierName: SupplierName;
  workingDays: number[]; // дни недели с 1 (понедельник) до 7 (воскресенье)
  cutoffTimes: { [warehouse: string]: string }; // Крайние сроки для каждого склада
  processingTime: { days?: number; hours?: number };
  specialConditions?: (
    currentTime: DateTime,
    result: SearchResultsParsed
  ) => DateTime;
}

interface AddToCartConfig {
  id: string;
  warehouse: string;
  quantity: number;
  code: string;
  supplier?: SupplierName;
}

type accountAlias = 'nal' | 'bezNal';

interface ugArticleSearchResult {
  distributorId: number;
  grp: null;
  code: string | '';
  brand: string;
  number: string;
  numberFix: string;
  description: string;
  availability: number;
  packing: number;
  deliveryPeriod: number;
  deliveryPeriodMax: number;
  deadlineReplace: '';
  distributorCode: '';
  supplierCode: number;
  supplierColor: null;
  supplierDescription: '';
  itemKey: string;
  price: number;
  weight: number;
  volume: null;
  lastUpdateTime: string | Date;
  additionalPrice: number;
  noReturn: boolean;
  isUsed: boolean;
  meta: {
    productId: number;
    wearout: number;
    isUsed: boolean;
    images: null;
    abcpWh: string;
  };
  deliveryProbability: 0;
}

/**
 * Интерфейс, описывающий товар в системе Автоспутник.
 */
interface TovarAutosputnik {
  /** Идентификатор группы номенклатуры */
  id_nom_groups: string;

  /** Название группы номенклатуры */
  name_nom_groups: string;

  /** Возможность возврата товара (0 - невозможно вернуть, 1 - возможно) */
  RETURNS_POSIBL: string;

  /** NW (необходимо уточнить назначение) */
  NW: string;

  /** Цена за единицу товара в валюте пользователя, выполняющего запрос */
  NEW_COST: string;

  /** Дата доставки товара с учетом выходных дней (МСК сервер) */
  DAYOFF2: string;

  /** Количество календарных дней доставки товара до точки выдачи */
  DAYOFF3: string;

  /** Количество рабочих дней доставки товара до точки выдачи */
  DAYOFF: string;

  /** Возможная задержка в сроке поставки (максимальный срок поставки) */
  N_DELTA: string;

  /** ИД производителя в системе компании Автоспутник */
  BRA_ID: string;

  /** Название товара в системе Автоспутник */
  NAME_TOVAR: string;

  /** Наличие товара на складе */
  STOCK: string;

  /** Артикул, запрошенный пользователем */
  ARTICUL: string;

  /** Расшифровка производителя по ИД */
  BRA_BRAND: string;

  /** Код склада поставщика */
  ID_SHOP_PRICES: string;

  /** Кратность для заказа */
  CRATN: string;

  /** Минимальное число товара, которое можно заказать */
  MINIMAL: string;

  /** Признак собственного склада компании (1 - свой, 0 - сторонний прайс) */
  F1C: string;

  /** Название склада компании (иное - сторонний прайс) */
  PRICE_NAME: string;

  /** Вероятность поставки в срок. В процентах (0 - нет заказов по поставщику) */
  SHIPPING_PROC: string;
}

//** Параметры для добавления в корзину ЮГ */
interface BasketPositionUG {
  number: string;
  brand: string;
  supplierCode: string;
  itemKey: string;
  quantity: number;
}

interface UgCartResponse {
  status: 1 | 0;
  errorMessage?: string;
  positions: Array<{
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
  }>;
}

interface BasketTurboCarsFrontendData {
  ZakazCode: string;
  QTY: string;
  StockID: string;
  nal: boolean;
}

interface BasketPositionTurboCars extends BasketTurboCarsFrontendData {
  DeliveryType?: '0'; //DeliveryType нужен для оригинальных запчастей, доделать бы
  Notes?: string;
  ExpressID?: '0';
}

interface AddResultXML {
  AddResult: {
    Message: string;
    ID: string;
    OrderedQTY: string;
    OrderedCode: string;
  };
}

interface ItemAutocompleteRow {
  brand: string;
  number: string;
  descr: string;
  url: string;
  id?: string;
}

interface ClarifyBrandResult {
  success: boolean;
  brands: ItemAutocompleteRow[];
  message: string;
}

interface ProviderErrorData {
  errorCode?: number;
  errorMessage?: string;
  // могут быть и другие поля, если нужно
}

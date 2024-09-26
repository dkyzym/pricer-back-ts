export type SupplierName = 'turboCars' | 'ug' | 'patriot' | 'profit';
// export type SupplierName = 'patriot' | 'turboCars' | 'ug' | 'orion' | 'armtek';

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

export type PageAction =
  | {
      action: 'init';
      supplier: SupplierName;
    }
  | {
      action: 'login';
      username: string;
      password: string;
      supplier: SupplierName;
    }
  | {
      action: 'logout';
      supplier: SupplierName;
    }
  | {
      action: 'autocomplete';
      supplier: SupplierName;
      query: string;
    }
  | {
      action: 'pick';
      supplier: SupplierName;
      item: ItemToParallelSearch;
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
  page: Page;
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

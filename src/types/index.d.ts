export type SupplierName = 'patriot' | 'turboCars' | 'ug' | 'orion' | 'armtek';

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
      item: SearchResult;
    };

interface LoginServiceParams {
  page: Page;
  username: string;
  password: string;
  supplier: SupplierName;
}

export interface SearchResult {
  id: string;
  brand: string;
  article: string;
  description: string;
  dataUrl: string;
}

export interface SearchResultsWithRestUg {
  id: string;
  article: string;
  brand: string;
  description: string;
  availability: number;
  price: number;
  warehouse: string;
  imageUrl: string;
  deadline: string | number;
  supplier: SupplierName;
}

export interface pageActionsResult {
  success: boolean;
  message: string;
  data?: SearchResult[] | SearchResultsWithRestUg[];
}

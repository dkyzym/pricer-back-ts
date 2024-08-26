export interface isLoggedInResult {
  success: boolean;
  message: string;
}

export type SupplierName = 'patriot' | 'turboCars' | 'ug' | 'orion' | 'armtek';

export interface Selectors {
  loginForm: string;
  credentialsEl: string;
  emailUsernameField: string;
  passwordField: string;
  loginBtn: string;
  logoutBtn: string;
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

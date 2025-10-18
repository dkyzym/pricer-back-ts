import { DateTime } from 'luxon';
import { SupplierName } from './common.types.js';
import { SearchResultsParsed } from './search.types.js';


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

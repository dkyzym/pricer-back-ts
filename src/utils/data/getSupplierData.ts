import { SUPPLIERS_DATA } from '@constants/index.js';
import { SupplierName } from 'types/index.js';

export const getSupplierData = (supplier: SupplierName) => {
  const { credentials, loginURL, logoutURL, selectors, dashboardURL } =
    SUPPLIERS_DATA[supplier];

  return {
    credentials,
    loginURL,
    logoutURL,
    selectors,
    dashboardURL,
  };
};

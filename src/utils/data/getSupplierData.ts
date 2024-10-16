import { SUPPLIERS_DATA } from '@constants/index';
import { SupplierName } from 'types';

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

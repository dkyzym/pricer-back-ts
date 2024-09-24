import { SupplierName } from 'types';
import { SUPPLIERS_DATA } from '../../constants/constants';

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

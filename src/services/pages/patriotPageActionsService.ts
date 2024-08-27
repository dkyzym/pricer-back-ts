import { SUPPLIERS_DATA } from '@utils/data/constants';
import { isLoggedInResult, PageAction, SupplierName } from '../../types';

import { loginPatriotService } from '../auth/patriot/loginPatriotService';
import { logoutPatriotService } from '../auth/patriot/logoutPatriotService';
import { getPage } from '../browserManager';

export const patriotPageActionsService = async (
  actionParams: PageAction
): Promise<isLoggedInResult> => {
  const supplier: SupplierName = 'patriot';
  const upperCaseSupplier = supplier.toUpperCase();

  const { loginURL } = SUPPLIERS_DATA[supplier];

  const page = await getPage(loginURL as string);

  try {
    if (actionParams.action === 'login') {
      const { username, password } = actionParams;

      return await loginPatriotService(page, username, password);
    } else if (actionParams.action === 'logout') {
      return await logoutPatriotService(page);
    }
  } catch (error) {
    console.error(
      `${upperCaseSupplier} Error performing action on Page Auth Actions:`,
      error
    );
    return {
      success: false,
      message: `${upperCaseSupplier} An error occurred during the action`,
    };
  }

  return {
    success: false,
    message: `${upperCaseSupplier} Invalid action`,
  };
};

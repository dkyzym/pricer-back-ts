import { isLoggedInResult, PageAction } from '../../types';

import { getSupplierData } from '../../utils/data/getSupplierData';
import { loginPatriotService } from '../auth/patriot/loginPatriotService';
import { logoutPatriotService } from '../auth/patriot/logoutPatriotService';
import { getPage } from '../browserManager';

export const patriotPageActionsService = async (
  actionParams: PageAction
): Promise<isLoggedInResult> => {
  const { supplier } = actionParams;

  const { loginURL } = getSupplierData(supplier);

  const page = await getPage(loginURL as string);

  try {
    if (actionParams.action === 'login') {
      const { username, password } = actionParams;

      return await loginPatriotService({ page, username, password, supplier });
    } else if (actionParams.action === 'logout') {
      return await logoutPatriotService(page, supplier);
    }
  } catch (error) {
    console.error(
      `${supplier}: Error performing action on Page Auth Actions:`,
      error
    );
    return {
      success: false,
      message: `${supplier}: An error occurred during the action`,
    };
  }

  return {
    success: false,
    message: `${supplier}: Invalid action`,
  };
};

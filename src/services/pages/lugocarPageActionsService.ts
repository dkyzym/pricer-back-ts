import { isLoggedInResult, PageAction } from '../../types';
import { getSupplierData } from '../../utils/data/getSupplierData';
import { loginTcService } from '../auth/lugocar/loginTcService';
import { logoutTcService } from '../auth/lugocar/logoutTcService';
import { getPage } from '../browserManager';

export const tcPageActionsService = async (
  actionParams: PageAction
): Promise<isLoggedInResult> => {
  const { action, supplier } = actionParams;
  const { loginURL } = getSupplierData(supplier);
  const page = await getPage(loginURL as string);

  try {
    if (action === 'login') {
      const { username, password } = actionParams;

      return await loginTcService({ page, username, password, supplier });
    } else if (action === 'logout') {
      return await logoutTcService(page, supplier);
    }
  } catch (error) {
    console.error(
      `${supplier}: Error performing action on Page Auth Actions: `,
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

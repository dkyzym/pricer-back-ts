import { getSupplierData } from '@utils/data/getSupplierData';
import { isLoggedInResult, PageAction } from 'types';
import { loginOrionService } from '../orion/loginOrionService';
import { logoutOrionService } from '../orion/logoutOrionService';
import { getPage } from '../puppeteerShared/browserManager';

export const orionPageActionsService = async (
  actionParams: PageAction
): Promise<isLoggedInResult> => {
  const { action, supplier } = actionParams;
  const { dashboardURL } = getSupplierData(supplier);
  const page = await getPage(dashboardURL as string);

  try {
    if (action === 'login') {
      const { username, password } = actionParams;

      return await loginOrionService({ page, username, password, supplier });
    } else if (action === 'logout') {
      return await logoutOrionService(page, supplier);
    }
  } catch (error) {
    console.error(
      `${supplier}: Error performing action on Orion Page Auth Actions:`,
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

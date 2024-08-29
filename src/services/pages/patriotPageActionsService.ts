import { isLoggedInResult, PageAction } from 'types';
import { getSupplierData } from 'utils/data/getSupplierData';
import { loginPatriotService } from '../patriot/loginPatriotService';
import { logoutPatriotService } from '../patriot/logoutPatriotService';
import { getPage } from '../puppeteerShared/browserManager';

export const patriotPageActionsService = async (
  actionParams: PageAction
): Promise<isLoggedInResult> => {
  const { action, supplier } = actionParams;
  const { loginURL } = getSupplierData(supplier);
  const page = await getPage(loginURL);

  try {
    switch (action) {
      case 'login': {
        const { username, password } = actionParams;
        return await loginPatriotService({
          page,
          username,
          password,
          supplier,
        });
      }
      case 'logout':
        return await logoutPatriotService(page, supplier);
      default:
        return {
          success: false,
          message: `${supplier}: Invalid action`,
        };
    }
  } catch (error) {
    console.error(
      `${supplier}: Error performing ${action} action on Page Auth Actions:`,
      error
    );
    return {
      success: false,
      message: `${supplier}: An error occurred during the ${action} action`,
    };
  }
};

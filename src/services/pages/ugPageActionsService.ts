import { isLoggedInResult, PageAction } from 'types';
import { getSupplierData } from 'utils/data/getSupplierData';
import { getPage } from '../puppeteerShared/browserManager';
import { autocompleteUgService } from '../ug/autocompleteUgService';
import { loginUgService } from '../ug/loginUgService';
import { logoutUgService } from '../ug/logoutUgService';

export const ugPageActionsService = async (
  actionParams: PageAction
): Promise<isLoggedInResult> => {
  const { action, supplier } = actionParams;
  const { loginURL } = getSupplierData(supplier);
  const page = await getPage(loginURL);

  try {
    switch (action) {
      case 'login': {
        const { username, password } = actionParams;
        return await loginUgService({
          page,
          username,
          password,
          supplier,
        });
      }
      case 'logout':
        return await logoutUgService(page, supplier);
      case 'autocomplete': {
        const { query } = actionParams;
        await autocompleteUgService(page, query, supplier);
        return {
          success: true,
          message: `${supplier}: Autocomplete successful`,
        };
      }
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

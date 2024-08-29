import { getSupplierData } from '@utils/data/getSupplierData';
import { isLoggedInResult, PageAction } from 'types';
import { getPage } from '../puppeteerShared/browserManager';
import { autocompleteUgService } from '../ug/autocompleteUgService';
import { loginUgService } from '../ug/loginUgService';
import { logoutUgService } from '../ug/logoutUgService';

export const ugPageActionsService = async (
  actionParams: PageAction
): Promise<isLoggedInResult> => {
  const { action, supplier } = actionParams;

  const { loginURL } = getSupplierData(supplier);

  const page = await getPage(loginURL as string);

  try {
    if (action === 'login') {
      const { username, password } = actionParams;

      return await loginUgService({ page, username, password, supplier });
    } else if (action === 'logout') {
      return await logoutUgService(page, supplier);
    } else if (action === 'autocomplete') {
      const { query } = actionParams;

      await autocompleteUgService(page, query, supplier);
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

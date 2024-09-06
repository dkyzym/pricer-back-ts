import { PageAction, pageActionsResult } from 'types';
import { getSupplierData } from 'utils/data/getSupplierData';
import { loginTurboCars } from '../lugocar/loginTurboCarsService';
import { logoutTurboCarsService } from '../lugocar/logoutTurboCarsService';
import { getPage } from '../puppeteerShared/browserManager';

export const turboCarsPageActionsService = async (
  actionParams: PageAction
): Promise<pageActionsResult> => {
  const { action, supplier } = actionParams;
  const { loginURL } = getSupplierData(supplier);
  const page = await getPage(loginURL as string);

  try {
    switch (action) {
      case 'login': {
        const { username, password } = actionParams;
        return await loginTurboCars({
          page,
          username,
          password,
          supplier,
        });
      }
      case 'logout':
        return await logoutTurboCarsService(page, supplier);
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

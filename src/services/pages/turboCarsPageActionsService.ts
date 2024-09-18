import { PageAction, pageActionsResult } from 'types';
import { getSupplierData } from 'utils/data/getSupplierData';
import { getPage } from '../puppeteerShared/browserManager';
import { itemDataTurboCarsService } from '../turboCars/itemDataTurboCarsService';
import { loginTurboCars } from '../turboCars/loginTurboCarsService';
import { logoutTurboCarsService } from '../turboCars/logoutTurboCarsService';

export const turboCarsPageActionsService = async (
  actionParams: PageAction
): Promise<pageActionsResult> => {
  const { action, supplier } = actionParams;
  const { loginURL } = getSupplierData(supplier);

  const page = await getPage(supplier, loginURL);

  try {
    console.log(`[${supplier}] Выполнение действия: ${action}`);

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

      case 'pick': {
        const { item, supplier, action } = actionParams;

        const result = await itemDataTurboCarsService({ page, item, supplier });

        return {
          success: true,
          message: `${supplier}: ${action} successful`,
          data: result,
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

import { logger } from 'config/logger';
import { PageAction, pageActionsResult } from 'types';
import { getSupplierData } from 'utils/data/getSupplierData';
import { logResultCount } from 'utils/stdLogs';
import { getPage } from '../browserManager';
import { addToCartTurboCarsService } from '../turboCars/addToCartTurboCarsService';
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
    logger.info(`[${supplier}] Выполнение действия: ${action}`);

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
        logResultCount(item, supplier, result);
        return {
          success: true,
          message: `${supplier}: ${action} successful`,
          data: result,
        };
      }

      case 'addToCart':
        const { count, item } = actionParams;

        return await addToCartTurboCarsService(page, supplier, item, count);

      default:
        return {
          success: false,
          message: `${supplier}: Invalid action`,
        };
    }
  } catch (error) {
    logger.error(
      `${supplier}: Error performing ${action} action on Page Auth Actions:`,
      error
    );
    return {
      success: false,
      message: `${supplier}: An error occurred during the ${action} action`,
    };
  }
};

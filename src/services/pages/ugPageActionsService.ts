import { logger } from 'config/logger';
import { PageAction, pageActionsResult } from 'types';
import { getSupplierData } from 'utils/data/getSupplierData';
import { logResultCount } from 'utils/stdLogs';
import { getPage } from '../browserManager';
import { autocompleteUgService } from '../ug/autocompleteUgService';
import { clarifyBrandService } from '../ug/clarifyBrandService';
import { itemDataUgService } from '../ug/itemDataUgService';
import { loginUgService } from '../ug/loginUgService';
import { logoutUgService } from '../ug/logoutUgService';

export const ugPageActionsService = async (
  actionParams: PageAction
): Promise<pageActionsResult> => {
  const { action, supplier } = actionParams;
  const { loginURL } = getSupplierData(supplier);
  logger.info(`${supplier} Выполнение действия: ${action}`);

  const page = await getPage(supplier, loginURL);

  try {
    switch (action) {
      case 'init': {
        return { success: true, message: `${supplier} page opened` };
      }
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

        const data = await autocompleteUgService(page, query, supplier);
        const hasData = Boolean(data.length);

        return {
          success: hasData,
          message: `${supplier}: Autocomplete successful`,
          data,
        };
      }
      case 'clarifyBrand': {
        const { query } = actionParams;

        const possibleBrands = await clarifyBrandService(page, query);

        const hasData = Boolean(possibleBrands.length);

        return {
          success: hasData,
          message: `${supplier}: Brand clarification successful`,
          data: possibleBrands,
        };
      }
      case 'pick': {
        const { item, supplier, action } = actionParams;

        const result = await itemDataUgService({ page, item, supplier });
        logResultCount(item, supplier, result);

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

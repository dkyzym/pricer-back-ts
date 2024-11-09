import { logger } from 'config/logger';
import { PageAction, pageActionsResult } from 'types';
import { getSupplierData } from 'utils/data/getSupplierData';
import { logResultCount } from 'utils/stdLogs';
import { checkElementTextForAuthorization } from '../../utils/auth/checkIsAuth';
import { NotLoggedInError } from '../../utils/errors';
import { getPage } from '../browserManager';
import { addToCartUgService } from '../ug/addToCartUgService';
import { autocompleteUgService } from '../ug/autocompleteUgService';
import { clarifyBrandService } from '../ug/clarifyBrandService';
import { itemDataUgService } from '../ug/itemDataUgService';
import { loginUgService } from '../ug/loginUgService';
import { logoutUgService } from '../ug/logoutUgService';

export const ugPageActionsService = async (
  actionParams: PageAction
): Promise<pageActionsResult> => {
  const { action, supplier } = actionParams;
  const { loginURL, credentials, selectors } = getSupplierData(supplier);
  logger.info(`[${supplier}] Выполнение действия: ${action}`);

  const page = await getPage(supplier, loginURL, 'sessionID');

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

        try {
          const possibleBrands = await clarifyBrandService(page, query);

          const hasData = possibleBrands.length > 0;

          return {
            success: true,
            message: hasData
              ? `${supplier}: Уточнение выполнено успешно`
              : `${supplier}: По запросу "${query}" данные не найдены`,
            data: possibleBrands,
          };
        } catch (error) {
          logger.error(`Ошибка в clarifyBrand: ${error}`);
          // Бросаем ошибку дальше для глобальной обработки
          throw error;
        }
      }

      case 'pick': {
        const { item, supplier, action } = actionParams;

        const isLoggedIn = await checkElementTextForAuthorization(
          page,
          selectors.credentialsEl,
          credentials
        );
        if (!isLoggedIn) {
          const notLoggedInMessage = `${supplier}: ${action} не залогинен`;
          logger.error(notLoggedInMessage);
          throw new NotLoggedInError(notLoggedInMessage);
        }

        const result = await itemDataUgService({ page, item, supplier });
        logResultCount(item, supplier, result);

        return {
          success: true,
          message: `${supplier}: ${action} successful`,
          data: result,
        };
      }

      case 'addToCart': {
        const { count, item } = actionParams;

        return await addToCartUgService(page, supplier, item, count);
      }

      default:
        return {
          success: false,
          message: `${supplier}: Некорректное действие`,
        };
    }
  } catch (error) {
    logger.error(
      `${supplier}: Ошибка при выполнении действия ${action} в Page Auth Actions:`,
      error
    );
    throw error;
  }
};

import { logger } from 'config/logger';
import { PageAction, pageActionsResult } from 'types';
import { getSupplierData } from 'utils/data/getSupplierData';
import { logResultCount } from 'utils/stdLogs';
import { checkTcAuth } from '../../utils/auth/checkIsAuth';
import { NotLoggedInError } from '../../utils/errors';
import { getPage } from '../browserManager';
import { addToCartTurboCarsService } from '../turboCars/addToCartTurboCarsService';
import { itemDataTurboCarsService } from '../turboCars/itemDataTurboCarsService';
import { loginTurboCars } from '../turboCars/loginTurboCarsService';
import { logoutTurboCarsService } from '../turboCars/logoutTurboCarsService';

export const turboCarsPageActionsService = async (
  actionParams: PageAction
): Promise<pageActionsResult> => {
  const { action, supplier } = actionParams;
  const { loginURL, credentials, selectors } = getSupplierData(supplier);

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

        const isLoggedIn = await checkTcAuth(
          page,
          selectors.credentialsEl,
          credentials
        );
        if (!isLoggedIn) {
          const notLoggedInMessage = `${supplier}: ${action} не залогинен`;
          logger.error(notLoggedInMessage);
          throw new NotLoggedInError(notLoggedInMessage); // Бросаем пользовательскую ошибку
        }
        const result = await itemDataTurboCarsService({ page, item, supplier });
        logResultCount(item, supplier, result);

        return {
          success: true,
          message: `${supplier}: ${action} успешно выполнено`,
          data: result,
        };
      }

      case 'addToCart': {
        const { count, item } = actionParams;

        return await addToCartTurboCarsService(page, supplier, item, count);
      }

      default:
        return {
          success: false,
          message: `${supplier}: Некорректное действие`,
        };
    }
  } catch (error) {
    logger.error(
      `${supplier}: Ошибка при выполнении действия ${action} в Turbo Cars Page Actions:`,
      error
    );
    throw error;
  }
};

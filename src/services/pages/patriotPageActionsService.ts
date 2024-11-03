import { logger } from 'config/logger';
import { PageAction, pageActionsResult } from 'types';
import { getSupplierData } from 'utils/data/getSupplierData';
import { checkElementTextForAuthorization } from '../../utils/auth/checkIsAuth';
import { NotLoggedInError } from '../../utils/errors';
import { getPage } from '../browserManager';
import { itemDataPatriotService } from '../patriot/itemDataPatriotService';
import { loginPatriotService } from '../patriot/loginPatriotService';
import { logoutPatriotService } from '../patriot/logoutPatriotService';

export const patriotPageActionsService = async (
  actionParams: PageAction
): Promise<pageActionsResult> => {
  const { action, supplier } = actionParams;
  const { loginURL, credentials, selectors } = getSupplierData(supplier);
  const page = await getPage(supplier, loginURL);
  logger.info(`[${supplier}] Выполнение действия: ${action}`);

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

        const result = await itemDataPatriotService({
          page,
          item,
          supplier,
        });

        return {
          success: true,
          message: `${supplier}: ${action} успешен`,
          data: result,
        };
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

import { logger } from 'config/logger';
import { accountAlias, PageAction, pageActionsResult } from 'types';
import { getSupplierData } from 'utils/data/getSupplierData';
import { logResultCount } from 'utils/stdLogs';
import { sessionManager } from '../../session/sessionManager';
import { checkTcAuth } from '../../utils/auth/checkIsAuth';
import { NotLoggedInError } from '../../utils/errors';
import { addToCartTurboCarsService } from '../turboCars/addToCartTurboCarsService';
import { itemDataTurboCarsService } from '../turboCars/itemDataTurboCarsService';
import { loginTurboCarsService } from '../turboCars/loginTurboCarsService';

export const turboCarsPageActionsService = async (
  actionParams: PageAction
): Promise<pageActionsResult> => {
  const { action, supplier, sessionID, accountAlias } = actionParams;
  const { selectors } = getSupplierData(supplier);

  const sessionKey = `${supplier}_${accountAlias}`;

  const session = sessionManager.getSession(sessionKey);
  if (!session) {
    throw new Error(`Session with ID ${sessionID} not found`);
  }

  const { page } = session;

  try {
    logger.info(`[${supplier}] Выполнение действия: ${action}`);

    switch (action) {
      case 'login': {
        const { username, password } = actionParams;

        return await loginTurboCarsService({
          page,
          username,
          password,
          supplier,
        });
      }

      case 'pick': {
        const { item, supplier, action } = actionParams;
        const { TURBOCARS_USERNAME, TURBOCARS_USERNAME_BN } = process.env;
        const username =
          accountAlias === 'nal' ? TURBOCARS_USERNAME : TURBOCARS_USERNAME_BN;

        const isLoggedIn = await checkTcAuth(
          page,
          selectors.credentialsEl,
          username as string
        );
        if (!isLoggedIn) {
          const notLoggedInMessage = `${supplier}: ${action} не залогинен`;
          logger.error(notLoggedInMessage);
          throw new NotLoggedInError(notLoggedInMessage);
        }
        const result = await itemDataTurboCarsService({ page, item, supplier });
        logResultCount(item, supplier, result, accountAlias as accountAlias);

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

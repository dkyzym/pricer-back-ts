import { SUPPLIERS_DATA } from '@utils/data/constants';
import { isLoggedInResult } from '../../types';
import { loginToOrionService } from '../auth/orion/loginToOrionService';
import { logoutFromOrionService } from '../auth/orion/logoutFromOrionService';
import { getPage } from '../browserManager';

const { dashboardURL } = SUPPLIERS_DATA['orion'];

type OrionAction =
  | { action: 'login'; username: string; password: string }
  | { action: 'logout' };

export const orionPageActionsService = async (
  actionParams: OrionAction
): Promise<isLoggedInResult> => {
  const page = await getPage(dashboardURL as string);

  let resultLoggedIn: isLoggedInResult = {
    success: false,
    message: 'Failed to login to Orion',
  };

  try {
    if (actionParams.action === 'login') {
      const { username, password } = actionParams;

      const isLoggedIn = await loginToOrionService(page, username, password);
      if (isLoggedIn) {
        return { success: isLoggedIn, message: 'Logged in to Orion' };
      }
    } else if (actionParams.action === 'logout') {
      await logoutFromOrionService(page);
      resultLoggedIn = { success: true, message: 'Logged out from Orion' };
    }
  } catch (error) {
    console.error('Error performing action on Orion Page Auth Actions:', error);
  }

  return resultLoggedIn;
};

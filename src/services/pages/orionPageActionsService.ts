import { SUPPLIERS_DATA } from '@utils/data/constants';
import { isLoggedInResult } from '../../types';
import { loginOrionService } from '../auth/orion/loginOrionService';
import { logoutOrionService } from '../auth/orion/logoutOrionService';
import { getPage } from '../browserManager';

const { dashboardURL } = SUPPLIERS_DATA['orion'];

type OrionAction =
  | { action: 'login'; username: string; password: string }
  | { action: 'logout' };

export const orionPageActionsService = async (
  actionParams: OrionAction
): Promise<isLoggedInResult> => {
  const page = await getPage(dashboardURL as string);

  try {
    if (actionParams.action === 'login') {
      const { username, password } = actionParams;

      return await loginOrionService(page, username, password);
    } else if (actionParams.action === 'logout') {
      return await logoutOrionService(page);
    }
  } catch (error) {
    console.error('Error performing action on Orion Page Auth Actions:', error);
    return {
      success: false,
      message: 'An error occurred during the action',
    };
  }

  return {
    success: false,
    message: 'Invalid action',
  };
};

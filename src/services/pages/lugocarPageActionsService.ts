import { SUPPLIERS_DATA } from '@utils/data/constants';
import { isLoggedInResult, PageAction } from '../../types';
import { loginTcService } from '../auth/lugocar/loginTcService';
import { logoutTcService } from '../auth/lugocar/logoutTcService';
import { getPage } from '../browserManager';

const { loginURL } = SUPPLIERS_DATA['turboCars'];

export const tcPageActionsService = async (
  actionParams: PageAction
): Promise<isLoggedInResult> => {
  const page = await getPage(loginURL as string);

  try {
    if (actionParams.action === 'login') {
      const { username, password } = actionParams;

      return await loginTcService(page, username, password);
    } else if (actionParams.action === 'logout') {
      return await logoutTcService(page);
    }
  } catch (error) {
    console.error('Error performing action on UG Page Auth Actions:', error);
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

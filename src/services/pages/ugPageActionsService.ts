import { SUPPLIERS_DATA } from '@utils/data/constants';
import { isLoggedInResult, PageAction } from '../../types';
import { loginUgService } from '../auth/ug/loginUGService';
import { logoutUgService } from '../auth/ug/logoutUgService';
import { getPage } from '../browserManager';

const { loginURL } = SUPPLIERS_DATA['ug'];

export const ugPageActionsService = async (
  actionParams: PageAction
): Promise<isLoggedInResult> => {
  const page = await getPage(loginURL as string);

  try {
    if (actionParams.action === 'login') {
      const { username, password } = actionParams;

      return await loginUgService(page, username, password);
    } else if (actionParams.action === 'logout') {
      return await logoutUgService(page);
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

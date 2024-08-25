import { SUPPLIERS_DATA } from '@utils/data/constants';
import { isLoggedInResult } from '../../types';
import { loginToOrionService } from '../auth/orion/loginToOrionService';
import { getPage } from '../browserManager';

const { loginURL, credentials, dashboardURL } = SUPPLIERS_DATA['orion'];

export const orionPageActionsService = async (
  username: string,
  password: string
): Promise<isLoggedInResult> => {
  const page = await getPage(dashboardURL);

  let resultLoggedIn: isLoggedInResult = {
    success: false,
    message: 'Failed to login to Orion',
  };

  try {
    const isLoggedIn = await loginToOrionService(page, username, password);
    if (isLoggedIn) {
      return { success: isLoggedIn, message: 'Logged in to Orion' };
    }
  } catch (error: unknown) {
    console.error('Error performing action on Orion Login:', error);
  }

  return resultLoggedIn;
};

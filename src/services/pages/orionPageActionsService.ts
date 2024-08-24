import { isLoggedInResult } from '../../types';
import { loginToOrionService } from '../auth/orion/loginToOrionService';
import { createPage } from '../browserManager';

export const orionPageActionsService = async (
  username: string,
  password: string
): Promise<isLoggedInResult> => {
  const page = await createPage();

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

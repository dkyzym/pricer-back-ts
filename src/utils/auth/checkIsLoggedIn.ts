import { UnAuthorizedError } from '../errors.js';

export const checkIsLoggedIn = (response: any, clientInfo: string) => {
  const isLoggedIn = response.includes(clientInfo);

  if (!isLoggedIn) {
    throw new UnAuthorizedError('Patriot  - Not logged in');
  }
};

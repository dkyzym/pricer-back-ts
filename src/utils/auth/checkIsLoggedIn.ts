import { UnAuthorizedError } from '../errors';

export const checkIsLoggedIn = (response: any, clientInfo: string) => {
  const isLoggedIn = response.includes(clientInfo);

  if (!isLoggedIn) {
    throw new UnAuthorizedError('Patriot  - Not logged in');
  }
};

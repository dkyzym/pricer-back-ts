import chalk from 'chalk';
import { UnAuthorizedError } from './errors.js';

export const checkIsLoggedIn = (
  pageContent: string,
  clientInfo: string
): boolean => {
  const isLoggedIn = pageContent
    .toLowerCase()
    .includes(clientInfo.toLowerCase());

  if (!isLoggedIn) {
    throw new UnAuthorizedError('Not logged in');
  }
  console.log(chalk.bgBlue('Has credentials:', isLoggedIn));
  return isLoggedIn;
};

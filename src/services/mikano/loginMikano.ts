import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import chalk from 'chalk';

import { CookieJar } from 'tough-cookie';
import { logger } from '../../config/logger/index.js';
import { ugHeaders } from '../../constants/headers.js';
import { checkIsLoggedIn } from '../../utils/auth/checkIsLoggedIn.js';

// Создаем общий cookieJar и клиент
const cookieJarMikano = new CookieJar();
const clientMikano = wrapper(
  axios.create({ jar: cookieJarMikano, withCredentials: true })
);

export const loginMikano = async () => {
  const MIKANO_CREDENTIALS = 'Кизим';
  const data = new URLSearchParams();
  const MIKANO_LOGIN_URL = process.env.MIKANO_LOGIN_URL;
  const username = process.env.MIKANO_USERNAME;
  const password = process.env.MIKANO_PASSWORD;
  const supplier = 'mikano';

  if (!username || !password || !MIKANO_LOGIN_URL) {
    throw new Error('Mikano credentials not found');
  }

  data.append('login', username);
  data.append('pass', password);

  const headers = ugHeaders;
  const response = await clientMikano.post(MIKANO_LOGIN_URL, data, {
    headers,
  });

  // Куки автоматически сохраняются в cookieJar
  const cookies = await cookieJarMikano.getCookies(MIKANO_LOGIN_URL);

  if (!cookies.some((cookie) => cookie.key === 'ABCPUser')) {
    throw new Error('Missing ABCPUser cookie Mikano');
  }

  checkIsLoggedIn(response.data, MIKANO_CREDENTIALS);

  logger.info(chalk.blue(`${supplier} Залогинен?: ${true}`));
  return true;
};

let isLoggingIn = false;
const loginQueue: (() => void)[] = [];

export const ensureMikanoLoggedIn = async () => {
  const MIKANO_LOGIN_URL = process.env.MIKANO_LOGIN_URL;

  if (!MIKANO_LOGIN_URL) {
    throw new Error('Mikano credentials not found');
  }

  const cookies = await cookieJarMikano.getCookies(MIKANO_LOGIN_URL);
  const abcUserCookie = cookies.find((cookie) => cookie.key === 'ABCPUser');
  const supplier = 'mikano';

  if (!abcUserCookie) {
    if (isLoggingIn) {
      // If already logging in, wait for the login to complete
      await new Promise<void>((resolve) => loginQueue.push(resolve));
    } else {
      isLoggingIn = true;
      try {
        logger.info(`Session cookie missing - ${supplier}, logging in...`);
        await loginMikano();
      } finally {
        isLoggingIn = false;
        // Resolve all queued promises
        loginQueue.forEach((resolve) => resolve());
        loginQueue.length = 0;
      }
    }
  } else {
    logger.info(
      `Session cookie found - ${supplier} , proceeding with request.`
    );
  }
};

export { clientMikano, cookieJarMikano };

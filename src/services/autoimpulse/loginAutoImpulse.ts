import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import chalk from 'chalk';
import fs from 'fs/promises';
import { CookieJar } from 'tough-cookie';
import { logger } from '../../config/logger';
import { ugHeaders } from '../../constants/headers';
import { checkIsLoggedIn } from '../../utils/auth/checkIsLoggedIn';

// Создаем общий cookieJar и клиент
const cookieJarAutoImpulse = new CookieJar();
const clientAutoImpulse = wrapper(
  axios.create({ jar: cookieJarAutoImpulse, withCredentials: true })
);

export const loginAutoImpulse = async () => {
  const AUTOIMPULSE_LOGIN_URL = 'https://lnr-auto-impulse.ru/';
  const AUTOIMPULSE_CREDENTIALS = 'Кизим';
  const data = new URLSearchParams();
  const username = process.env.AUTOIMPULSE_USERNAME;
  const password = process.env.AUTOIMPULSE_PASSWORD;
  const supplier = 'AutoImpulse';

  if (!username || !password) {
    throw new Error('AutoImpulse credentials not found');
  }

  data.append('login', username);
  data.append('pass', password);

  const headers = ugHeaders;
  const response = await clientAutoImpulse.post(AUTOIMPULSE_LOGIN_URL, data, {
    headers,
  });

  fs.writeFile('some.Response.json', JSON.stringify(response.data));

  // Куки автоматически сохраняются в cookieJar
  const cookies = await cookieJarAutoImpulse.getCookies(AUTOIMPULSE_LOGIN_URL);
  if (!cookies.some((cookie) => cookie.key === 'ABCPUser')) {
    throw new Error('Missing ABCPUser cookie Autoimpulse');
  }

  checkIsLoggedIn(response.data, AUTOIMPULSE_CREDENTIALS);

  logger.info(chalk.blue(`${supplier} Залогинен?: ${true}`));
  return true;
};

let isLoggingIn = false;
const loginQueue: (() => void)[] = [];

export const ensureAutoImpulseLoggedIn = async () => {
  const AUTOIMPULSE_LOGIN_URL = 'https://lnr-auto-impulse.ru/';
  const cookies = await cookieJarAutoImpulse.getCookies(AUTOIMPULSE_LOGIN_URL);
  const abcUserCookie = cookies.find((cookie) => cookie.key === 'ABCPUser');
  const supplier = 'AutoImpulse';

  if (!abcUserCookie) {
    if (isLoggingIn) {
      // If already logging in, wait for the login to complete
      await new Promise<void>((resolve) => loginQueue.push(resolve));
    } else {
      isLoggingIn = true;
      try {
        logger.info(`Session cookie missing - ${supplier}, logging in...`);
        await loginAutoImpulse();
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

export { clientAutoImpulse, cookieJarAutoImpulse };

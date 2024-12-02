import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import { ugHeaders } from '../../constants/headers';
import { checkIsLoggedIn } from '../../utils/auth/checkIsLoggedIn';

// Создаем общий cookieJar и клиент
const cookieJar = new CookieJar();
const client = wrapper(axios.create({ jar: cookieJar, withCredentials: true }));

export const loginPatriot = async () => {
  const PATRIOT_LOGIN_URL = 'https://optautotorg.com/';
  const PATRIOT_CREDENTIALS = 'Кизим';
  const data = new URLSearchParams();
  const username = process.env.PATRIOT_USERNAME;
  const password = process.env.PATRIOT_PASSWORD;

  if (!username || !password) {
    throw new Error('Patriot credentials not found');
  }

  data.append('login', username);
  data.append('pass', password);

  const headers = ugHeaders;
  const response = await client.post(PATRIOT_LOGIN_URL, data, { headers });

  // Куки автоматически сохраняются в cookieJar
  const cookies = await cookieJar.getCookies(PATRIOT_LOGIN_URL);
  if (!cookies.some((cookie) => cookie.key === 'ABCPUser')) {
    throw new Error('Missing ABCPUser cookie');
  }

  checkIsLoggedIn(response.data, PATRIOT_CREDENTIALS);
  return true;
};

// Экспортируем cookieJar и клиент для использования в других модулях
export { client, cookieJar };

// import { client, cookieJar } from 'путь-к-модулю-loginPatriot';

// // Пример использования client
// const fetchData = async () => {
//   const response = await client.get('https://optautotorg.com/some-endpoint', {
//     headers: ugHeaders,
//   });
//   // Ваш код
// };

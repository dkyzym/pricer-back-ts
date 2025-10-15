import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';

const baseURL = 'https://avtopartner-yug.ru';

// Глобальный jar, сохраняющий все куки между запросами
export const cookieJarAvtoPartner = new CookieJar();

export const clientAvtoPartner = wrapper(
  axios.create({
    baseURL,
    jar: cookieJarAvtoPartner,
    withCredentials: true, // критически важно!
    maxRedirects: 5,       // Drupal часто делает redirect после логина
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0',
    },
  })
);


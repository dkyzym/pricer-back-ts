import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import { avtoPartnerUserAgent } from '../../constants/headers.js';

const baseURL = 'https://avtopartner-yug.ru';

export const cookieJarAvtoPartner = new CookieJar();

export const clientAvtoPartner = wrapper(
  axios.create({
    baseURL,
    jar: cookieJarAvtoPartner,
    withCredentials: true,
    maxRedirects: 5, // Drupal часто делает redirect после логина
    headers: {
      'User-Agent': avtoPartnerUserAgent,
    },
  })
);

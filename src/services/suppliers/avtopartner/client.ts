import axios from 'axios';
import { HttpsCookieAgent } from 'http-cookie-agent/http';
import { CookieJar } from 'tough-cookie';
import { avtoPartnerUserAgent } from '../../../constants/headers.js';

const baseURL = 'https://avtopartner-yug.ru';

export const cookieJarAvtoPartner = new CookieJar();

const httpsAgent = new HttpsCookieAgent({
  cookies: { jar: cookieJarAvtoPartner },
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 10,
  timeout: 10_000,
});

export const clientAvtoPartner = axios.create({
  baseURL,
  httpsAgent,
  withCredentials: true,
  maxRedirects: 5, // Drupal часто делает redirect после логина
  headers: {
    'User-Agent': avtoPartnerUserAgent,
  },
});

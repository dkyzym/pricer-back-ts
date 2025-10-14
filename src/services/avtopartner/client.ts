import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';

export const cookieJarAvtoPartner = new CookieJar();
export const clientAvtoPartner = wrapper(
  axios.create({
    jar: cookieJarAvtoPartner,
  })
);

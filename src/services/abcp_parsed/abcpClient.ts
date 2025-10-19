import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import chalk from 'chalk';
import * as cheerio from 'cheerio';
import { CookieJar } from 'tough-cookie';

import { logger } from '../../config/logger/index.js';
import { ugHeaders } from '../../constants/headers.js';
import { ParallelSearchParams, SearchResultsParsed } from '../../types/search.types.js';
import { checkIsLoggedIn } from '../../utils/auth/checkIsLoggedIn.js';
import { parsePickedABCPresults } from '../../utils/parsePickedABCPresults.js';

export interface AbcpClientConfig {
  supplierName: string;
  baseUrl: string;
  credentials: {
    username?: string;
    password?: string;
  };
  loggedInIndicator: string;
}

// Фабричная функция для создания клиента
export const createAbcpClient = (config: AbcpClientConfig) => {
  if (!config.credentials.username || !config.credentials.password || !config.baseUrl) {
    throw new Error(`Credentials or baseUrl not found for supplier: ${config.supplierName}`);
  }

  // --- Приватное состояние, инкапсулированное замыканием ---
  const cookieJar = new CookieJar();
  const client: AxiosInstance = wrapper(axios.create({ jar: cookieJar, withCredentials: true }));
  let isLoggingIn = false;
  const loginQueue: (() => void)[] = [];
  // ---

  const login = async (): Promise<boolean> => {
    const { supplierName, baseUrl, credentials, loggedInIndicator } = config;
    const data = new URLSearchParams();
    data.append('login', credentials.username!);
    data.append('pass', credentials.password!);

    const response = await client.post(baseUrl, data, { headers: ugHeaders });
    const cookies = await cookieJar.getCookies(baseUrl);
    if (!cookies.some((cookie) => cookie.key === 'ABCPUser')) {
      throw new Error(`Missing ABCPUser cookie for ${supplierName}`);
    }
    checkIsLoggedIn(response.data, loggedInIndicator);
    logger.info(chalk.blue(`${supplierName} Logged in: ${true}`));
    return true;
  };

  const ensureLoggedIn = async (): Promise<void> => {
    const { supplierName, baseUrl } = config;
    const cookies = await cookieJar.getCookies(baseUrl);
    const abcUserCookie = cookies.find((cookie) => cookie.key === 'ABCPUser');

    if (!abcUserCookie) {
      if (isLoggingIn) {
        await new Promise<void>((resolve) => loginQueue.push(resolve));
      } else {
        isLoggingIn = true;
        try {
          logger.info(`Session cookie missing for ${supplierName}, logging in...`);
          await login();
        } finally {
          isLoggingIn = false;
          loginQueue.forEach((resolve) => resolve());
          loginQueue.length = 0;
        }
      }
    }
  };

  const makeRequest = async (url: string, options: any = {}): Promise<AxiosResponse> => {
    await ensureLoggedIn();
    let response = await client.get(url, options);

    if (!response.data.includes(config.loggedInIndicator) || response.status === 401) {
      logger.info(`Session expired for ${config.supplierName}, re-logging in...`);
      await login();
      response = await client.get(url, options);
    }
    return response;
  };

  const searchItem = async ({ item, supplier, userLogger }: ParallelSearchParams): Promise<SearchResultsParsed[]> => {
    const { baseUrl } = config;
    const searchUrl = `${baseUrl}/search?pcode=${encodeURIComponent(item.article)}`;
    const response = await makeRequest(searchUrl, { headers: ugHeaders });
    const $ = cheerio.load(response.data);
    const dataLinkContent = `${encodeURIComponent(item.brand)}/${encodeURIComponent(item.article)}`;
    const elements = $('.startSearching').filter((_, el) => {
      const dataLink = $(el).attr('data-link') || '';
      return dataLink.toLowerCase() === `/search/${dataLinkContent.toLowerCase()}`;
    });

    let finalHtml: string;
    if (elements.length > 0) {
      userLogger.info(`[${supplier}] Exact item found, making a second request.`);
      const detailUrl = `${baseUrl}/search/${dataLinkContent}`;
      const detailResponse = await makeRequest(detailUrl, { headers: ugHeaders });
      finalHtml = detailResponse.data;
    } else {
      userLogger.info(`[${supplier}] Exact item not found. Parsing search results page.`);
      finalHtml = response.data;
    }

    return parsePickedABCPresults({ html: finalHtml, item, supplier, userLogger });
  };

  // Возвращаем объект с публичными методами
  return {
    searchItem,
    makeRequest,
  };
};

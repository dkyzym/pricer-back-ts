import axios, { AxiosInstance, AxiosResponse } from 'axios';
import axiosRetry from 'axios-retry';
import chalk from 'chalk';
import * as cheerio from 'cheerio';
import { HttpsCookieAgent } from 'http-cookie-agent/http';
import { CookieJar } from 'tough-cookie';

import { logger } from '../../../config/logger/index.js';
import { ugHeaders } from '../../../constants/headers.js';
import {
  ParallelSearchParams,
  SearchResultsParsed,
} from '../../../types/search.types.js';
import { checkIsLoggedIn } from '../../../utils/auth/checkIsLoggedIn.js';
import { transformArticleByBrand } from '../../../utils/data/brand/transformArticleByBrand.js';
import { parsePickedABCPresults } from '../../../utils/parsePickedABCPresults.js';

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
  if (
    !config.credentials.username ||
    !config.credentials.password ||
    !config.baseUrl
  ) {
    throw new Error(
      `Credentials or baseUrl not found for supplier: ${config.supplierName}`
    );
  }

  // --- Приватное состояние, инкапсулированное замыканием ---
  const cookieJar = new CookieJar();

  // HttpsCookieAgent объединяет https.Agent (пул соединений) и cookie jar в одном агенте
  const httpsAgent = new HttpsCookieAgent({
    cookies: { jar: cookieJar },
    keepAlive: true,
    keepAliveMsecs: 1000,
    maxSockets: 10,
    maxFreeSockets: 5,
    timeout: 10_000,
  });

  const client: AxiosInstance = axios.create({
    httpsAgent,
    timeout: 15_000,
  });

  axiosRetry(client, {
    retries: 3,
    retryDelay: axiosRetry.exponentialDelay,
    retryCondition: (error) =>
      axiosRetry.isNetworkOrIdempotentRequestError(error) ||
      error.code === 'ECONNRESET' ||
      error.code === 'ETIMEDOUT' ||
      error.message?.includes('socket disconnected'),
    onRetry: (retryCount, error) => {
      logger.warn(
        `[${config.supplierName}] Retry ${retryCount}/3: ${error.message}`
      );
    },
  });

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

  const ensureLoggedIn = async (forceLogin = false): Promise<void> => {
    const { supplierName, baseUrl } = config;
    const cookies = await cookieJar.getCookies(baseUrl);
    const abcUserCookie = cookies.find((cookie) => cookie.key === 'ABCPUser');

    if (!abcUserCookie || forceLogin) {
      if (isLoggingIn) {
        await new Promise<void>((resolve) => loginQueue.push(resolve));
      } else {
        isLoggingIn = true;
        try {
          logger.info(
            `Session ${forceLogin ? 'expired' : 'missing'} for ${supplierName}, logging in...`
          );
          if (forceLogin) {
            await cookieJar.removeAllCookies();
          }
          await login();
        } finally {
          isLoggingIn = false;
          loginQueue.forEach((resolve) => resolve());
          loginQueue.length = 0;
        }
      }
    }
  };

  const makeRequest = async (
    url: string,
    options: any = {}
  ): Promise<AxiosResponse> => {
    await ensureLoggedIn();

    let response: AxiosResponse;
    try {
      response = await client.get(url, options);
    } catch (error: any) {
      if (error.response?.status === 401) {
        logger.info(
          `401 received for ${config.supplierName}, entering login queue...`
        );
        await ensureLoggedIn(true);
        return client.get(url, options);
      }
      throw error;
    }

    const isHtmlResponse = typeof response.data === 'string';
    if (isHtmlResponse && !response.data.includes(config.loggedInIndicator)) {
      logger.info(
        `Session expired for ${config.supplierName}, entering login queue...`
      );
      await ensureLoggedIn(true);
      response = await client.get(url, options);
    }

    return response;
  };

  const searchItem = async ({
    item,
    supplier,
    userLogger,
  }: ParallelSearchParams): Promise<SearchResultsParsed[]> => {
    const { baseUrl } = config;
    const articleToSearch = transformArticleByBrand(
      item.article,
      item.brand,
      supplier
    );

    const searchUrl = `${baseUrl}/search?pcode=${encodeURIComponent(articleToSearch)}`;
    const response = await makeRequest(searchUrl, { headers: ugHeaders });
    const $ = cheerio.load(response.data);
    const dataLinkContent = `${encodeURIComponent(item.brand)}/${encodeURIComponent(
      articleToSearch
    )}`;

    const elements = $('.startSearching').filter((i, el) => {
      const dataLink = $(el).attr('data-link') || '';

      return (
        dataLink.toLowerCase() === `/search/${dataLinkContent.toLowerCase()}`
      );
    });

    let finalHtml: string;
    if ($('.searchResultsTableWrapper').length > 0) {
      userLogger.info(
        `[${supplier}] DEBUG: Branch A (Direct Page). Passing to parser.`
      );
      finalHtml = response.data; // Эта страница - уже то, что нам нужно
    }
    // Иначе, это страница со списком
    else if (elements.length > 0) {
      userLogger.info(
        `[${supplier}] DEBUG: Branch B (List Page). Making 2nd request.`
      );
      const detailUrl = `${baseUrl}/search/${dataLinkContent}`;
      const detailResponse = await makeRequest(detailUrl, {
        headers: ugHeaders,
      });
      finalHtml = detailResponse.data;
    } else {
      userLogger.info(
        `[${supplier}] DEBUG: Branch C (No match). Passing current page to parser.`
      );
      finalHtml = response.data;
    }

    return parsePickedABCPresults({
      html: finalHtml,
      item,
      supplier,
      userLogger,
      articleSearched: articleToSearch,
    });
  };

  // Возвращаем объект с публичными методами
  return {
    searchItem,
    makeRequest,
  };
};

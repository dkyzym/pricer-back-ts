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
import { yieldToEventLoop } from '../../../utils/yieldToEventLoop.js';
import type { AbcpRequestOptions } from './abcpOrderServiceParser.js';

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
export const createAbcpClientParser = (config: AbcpClientConfig) => {
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
    retryCondition: (error) => {
      // CanceledError (ERR_CANCELED) — штатная отмена через AbortSignal, повторять нельзя
      if (error.code === 'ERR_CANCELED') return false;
      return (
        axiosRetry.isNetworkOrIdempotentRequestError(error) ||
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT' ||
        error.message?.includes('socket disconnected')
      );
    },
    onRetry: (retryCount, error) => {
      logger.warn(
        `[${config.supplierName}] Retry ${retryCount}/3: ${error.message}`
      );
    },
  });

  let isLoggingIn = false;
  const loginQueue: (() => void)[] = [];
  // ---

  const login = async (signal?: AbortSignal): Promise<boolean> => {
    const { supplierName, baseUrl, credentials, loggedInIndicator } = config;
    const data = new URLSearchParams();
    data.append('login', credentials.username!);
    data.append('pass', credentials.password!);

    const response = await client.post(baseUrl, data, { headers: ugHeaders, signal });
    const cookies = await cookieJar.getCookies(baseUrl);
    if (!cookies.some((cookie) => cookie.key === 'ABCPUser')) {
      throw new Error(`Missing ABCPUser cookie for ${supplierName}`);
    }
    checkIsLoggedIn(response.data, loggedInIndicator);
    logger.info(chalk.blue(`${supplierName} Logged in: ${true}`));
    return true;
  };

  const ensureLoggedIn = async (forceLogin = false, signal?: AbortSignal): Promise<void> => {
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
          await login(signal);
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
    options: AbcpRequestOptions = {}
  ): Promise<AxiosResponse> => {
    const { signal } = options;
    await ensureLoggedIn(false, signal);

    const logCookies = async () => {
      const cookies = await cookieJar.getCookies(config.baseUrl);
      return cookies.map((c) => ({ key: c.key, value: c.value }));
    };

    let response: AxiosResponse;
    try {
      const cookiesBefore = await logCookies();
      logger.info(`[${config.supplierName}] makeRequest GET (один jar): куки до запроса`, {
        count: cookiesBefore.length,
        cookies: cookiesBefore,
      });

      response = await client.get(url, options);
    } catch (error: any) {
      // CanceledError не должен вызывать ре-логин — пробрасываем сразу
      if (axios.isCancel(error)) throw error;

      if (error.response?.status === 401) {
        logger.info(
          `401 received for ${config.supplierName}, entering login queue...`
        );
        await ensureLoggedIn(true, signal);
        return client.get(url, options);
      }
      throw error;
    }

    const isHtmlResponse = typeof response.data === 'string';
    if (isHtmlResponse && !response.data.includes(config.loggedInIndicator)) {
      logger.info(
        `Session expired for ${config.supplierName}, entering login queue...`
      );
      await ensureLoggedIn(true, signal);
      const cookiesAfterLogin = await logCookies();
      logger.info(`[${config.supplierName}] makeRequest: после логина (тот же jar), повторный GET`, {
        count: cookiesAfterLogin.length,
        cookies: cookiesAfterLogin,
      });
      response = await client.get(url, options);
    }

    const cookiesAfterResponse = await logCookies();
    const bodyLen = typeof response.data === 'string' ? response.data.length : 0;
    const hasIndicator = typeof response.data === 'string' && response.data.includes(config.loggedInIndicator);
    const bodySnippet =
      typeof response.data === 'string'
        ? response.data.slice(0, 400).replace(/\s+/g, ' ')
        : '';
    logger.info(`[${config.supplierName}] makeRequest возврат: куки и ответ`, {
      count: cookiesAfterResponse.length,
      cookies: cookiesAfterResponse,
      bodyLen,
      hasLoggedInIndicator: hasIndicator,
      loggedInIndicator: config.loggedInIndicator,
      bodySnippet: bodySnippet.slice(0, 300),
    });

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

    let finalHtml: string;

    // Быстрая строковая проверка вместо cheerio.load() для Branch A (самый частый путь).
    // Экономим ~20-80ms синхронной блокировки Event Loop на каждый поиск.
    if (response.data.includes('searchResultsTableWrapper')) {
      userLogger.info(
        `[${supplier}] DEBUG: Branch A (Direct Page). Passing to parser.`
      );
      finalHtml = response.data;
    } else {
      // Branch B/C: нужен DOM-парсинг для проверки data-link атрибутов
      await yieldToEventLoop();
      const $ = cheerio.load(response.data);

      const dataLinkContent = `${encodeURIComponent(item.brand)}/${encodeURIComponent(
        articleToSearch
      )}`;

      const elements = $('.startSearching').filter((_i, el) => {
        const dataLink = $(el).attr('data-link') || '';
        return (
          dataLink.toLowerCase() === `/search/${dataLinkContent.toLowerCase()}`
        );
      });

      if (elements.length > 0) {
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
    }

    return parsePickedABCPresults({
      html: finalHtml,
      item,
      supplier,
      userLogger,
      articleSearched: articleToSearch,
    });
  };

  /**
   * POST-аналог makeRequest: авторизация, retry при 401 и проверка HTML-индикатора сессии.
   * Запросы, упавшие из-за протухшей сессии, встают в ту же loginQueue, что и GET-запросы.
   */
  const makePostRequest = async (
    url: string,
    data: any,
    options: AbcpRequestOptions = {}
  ): Promise<AxiosResponse> => {
    const { signal } = options;
    await ensureLoggedIn(false, signal);

    let response: AxiosResponse;
    try {
      response = await client.post(url, data, options);
    } catch (error: any) {
      if (axios.isCancel(error)) throw error;

      if (error.response?.status === 401) {
        logger.info(
          `401 received for ${config.supplierName}, entering login queue...`
        );
        await ensureLoggedIn(true, signal);
        return client.post(url, data, options);
      }
      throw error;
    }

    const isHtmlResponse = typeof response.data === 'string';
    if (isHtmlResponse && !response.data.includes(config.loggedInIndicator)) {
      logger.info(
        `Session expired for ${config.supplierName}, entering login queue...`
      );
      await ensureLoggedIn(true, signal);
      response = await client.post(url, data, options);
    }

    return response;
  };

  /** Для отладки: возвращает текущие куки для baseUrl (key + value). */
  const getCookiesForBaseUrl = async (): Promise<Array<{ key: string; value: string }>> => {
    const cookies = await cookieJar.getCookies(config.baseUrl);
    return cookies.map((c) => ({ key: c.key, value: c.value }));
  };

  return {
    config,
    searchItem,
    makeRequest,
    makePostRequest,
    getCookiesForBaseUrl,
  };
};

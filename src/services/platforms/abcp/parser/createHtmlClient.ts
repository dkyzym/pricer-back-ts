import axios, { AxiosInstance, AxiosResponse } from 'axios';
import axiosRetry from 'axios-retry';
import chalk from 'chalk';
import * as cheerio from 'cheerio';
import { HttpsCookieAgent } from 'http-cookie-agent/http';
import { CookieJar } from 'tough-cookie';
import { v4 as uuidv4 } from 'uuid';

import { logger } from '../../../../config/logger/index.js';
import { abcpHeaders } from '../../../../constants/headers.js';
import {
    ItemAutocompleteRow,
    ParallelSearchParams,
    SearchResultsParsed,
} from '../../../../types/search.types.js';
import { checkIsLoggedIn } from '../../../../utils/auth/checkIsLoggedIn.js';
import { resolveAbcpHtmlAfterUnpricedRetries } from '../../../../utils/abcp/abcpUnpricedHtmlRetry.js';
import { transformArticleByBrand } from '../../../../utils/data/brand/transformArticleByBrand.js';
import { parsePickedABCPresults } from '../../../../utils/parsePickedABCPresults.js';
import { yieldToEventLoop } from '../../../../utils/yieldToEventLoop.js';
import type { AbcpRequestOptions } from './fetchOrdersHtml.js';

export interface AbcpClientConfig {
  supplierName: string;
  baseUrl: string;
  credentials: {
    username?: string;
    password?: string;
  };
  loggedInIndicator: string;
}

/** Единый таймаут HTTP для ABCP HTML: оформление заказа и актуализация корзины у парсируемых поставщиков. */
const ABCP_HTML_HTTP_TIMEOUT_MS = 15_000;

// Фабричная функция для создания клиента
export const createHtmlClient = (rawConfig: AbcpClientConfig) => {
  if (
    !rawConfig.credentials.username ||
    !rawConfig.credentials.password ||
    !rawConfig.baseUrl
  ) {
    throw new Error(
      `Credentials or baseUrl not found for supplier: ${rawConfig.supplierName}`
    );
  }

  // Завершающий слэш в MIKANO_LOGIN_URL даёт двойной слэш в путях (`//ajaxRoute`, `//cart`) и 404 на deletePositions
  const config: AbcpClientConfig = {
    ...rawConfig,
    baseUrl: rawConfig.baseUrl.replace(/\/+$/, ''),
  };

  // --- Приватное состояние, инкапсулированное замыканием ---
  const cookieJar = new CookieJar();

  // HttpsCookieAgent объединяет https.Agent (пул соединений) и cookie jar в одном агенте
  const httpsAgent = new HttpsCookieAgent({
    cookies: { jar: cookieJar },
    keepAlive: true,
    keepAliveMsecs: 1000,
    maxSockets: 10,
    maxFreeSockets: 5,
    timeout: ABCP_HTML_HTTP_TIMEOUT_MS,
  });

  const client: AxiosInstance = axios.create({
    httpsAgent,
    timeout: ABCP_HTML_HTTP_TIMEOUT_MS,
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

    const response = await client.post(baseUrl, data, { headers: abcpHeaders, signal });
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

    let response: AxiosResponse;
    try {
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

    // 302 без тела: проверка loggedInIndicator по пустому HTML дала бы ложный «разлогин»
    const isRedirectResponse = response.status >= 300 && response.status < 400;
    const isHtmlResponse = typeof response.data === 'string';
    if (
      !isRedirectResponse &&
      isHtmlResponse &&
      !response.data.includes(config.loggedInIndicator)
    ) {
      logger.info(
        `Session expired for ${config.supplierName}, entering login queue...`
      );
      await ensureLoggedIn(true, signal);
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

    const response = await makeRequest(searchUrl, { headers: abcpHeaders });

    let finalHtml: string;
    /** URL для повторной загрузки при «скелетной» таблице без цен (та же страница). */
    let refetchUrlIfIncomplete: string;

    const firstHasWrapper = response.data.includes('searchResultsTableWrapper');

    // Быстрая строковая проверка вместо cheerio.load() для Branch A (самый частый путь).
    // Экономим ~20-80ms синхронной блокировки Event Loop на каждый поиск.
    if (firstHasWrapper) {
      userLogger.info(
        `[${supplier}] DEBUG: Branch A (Direct Page). Passing to parser.`
      );
      finalHtml = response.data;
      refetchUrlIfIncomplete = searchUrl;
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
          headers: abcpHeaders,
        });
        finalHtml = detailResponse.data;
        refetchUrlIfIncomplete = detailUrl;
      } else {
        userLogger.info(
          `[${supplier}] DEBUG: Branch C (No match). Passing current page to parser.`
        );
        finalHtml = response.data;
        refetchUrlIfIncomplete = searchUrl;
      }
    }

    finalHtml = await resolveAbcpHtmlAfterUnpricedRetries(
      String(finalHtml ?? ''),
      async () =>
        String(
          (
            await makeRequest(refetchUrlIfIncomplete, {
              headers: abcpHeaders,
            })
          ).data ?? ''
        )
    );

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

  /**
   * Парсит таблицу globalCase (ABCP «список брендов по артикулу»).
   * Каждая строка .startSearching содержит бренд, код детали и описание.
   */
  const parseBrandsFromHtml = (html: string): ItemAutocompleteRow[] => {
    const $ = cheerio.load(html);
    const rows = $('table.globalCase tr.startSearching');
    const result: ItemAutocompleteRow[] = [];

    rows.each((_i, el) => {
      const $row = $(el);
      const brand = $row.find('td.caseBrand a.brandInfoLink').text().trim();
      const number = $row.find('td.casePartCode').text().trim();
      const descr = $row.find('td.caseDescription').text().trim();

      if (brand && number) {
        result.push({ brand, number, descr, url: '', id: uuidv4() });
      }
    });

    return result;
  };

  /**
   * Получает список брендов по артикулу через HTML-поиск ABCP.
   * Использует тот же механизм авторизации (ensureLoggedIn), что и searchItem.
   */
  const searchBrands = async (article: string): Promise<ItemAutocompleteRow[]> => {
    const searchUrl = `${config.baseUrl}/search?pcode=${encodeURIComponent(article)}`;
    const response = await makeRequest(searchUrl, { headers: abcpHeaders });
    return parseBrandsFromHtml(response.data);
  };

  return {
    config,
    searchItem,
    searchBrands,
    makeRequest,
    makePostRequest,
  };
};

export type AbcpClient = ReturnType<typeof createHtmlClient>;

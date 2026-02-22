import axios, {
  AxiosError,
  AxiosHeaders,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from 'axios';
import axiosRetry, { isNetworkOrIdempotentRequestError } from 'axios-retry';
import chalk from 'chalk';
import { HttpsProxyAgent } from 'https-proxy-agent';

import {
  PROXY_AUTH,
  PROXY_HOST,
  PROXY_PORT,
  suppliers,
} from '../../config/api/config.js';
import { logger } from '../../config/logger/index.js';

import { SupplierName } from '../../types/common.types.js';
import { checkProxy } from '../../utils/api/checkProxy.js';
import { generateMD5 } from '../../utils/generateMD5.js';
import { getLocalIP } from '../../utils/getLocalIP.js';

// 1. Храним ПРОМИС инициализации, а не просто boolean.
// Это позволит любым параллельным запросам дождаться одной и той же проверки.
let proxyInitPromise: Promise<boolean> | null = null;

// 2. Кэш инстансов. Экономим память и переиспользуем TCP-соединения (keepAlive)
const axiosInstancesCache = new Map<SupplierName, AxiosInstance>();

/**
 * Инициализирует проверку прокси. Можно вызывать сколько угодно раз,
 * реальная проверка пройдет только один раз.
 */
export const initProxyCheck = (): Promise<boolean> => {
  if (!proxyInitPromise) {
    proxyInitPromise = (async () => {
      try {
        const localIP = await getLocalIP();

        if (localIP === PROXY_HOST) {
          logger.info(
            `Текущий IP (${localIP}) = PROXY_HOST. Прокси использовать не будем.`
          );
          return false;
        }

        const proxyAuthPart = PROXY_AUTH ? `${PROXY_AUTH}@` : '';
        const proxyUrl = `http://${proxyAuthPart}${PROXY_HOST}:${PROXY_PORT}`;
        const agent = new HttpsProxyAgent(proxyUrl, { keepAlive: true });

        const isProxyWorking = await checkProxy(agent);

        if (!isProxyWorking) {
          logger.error(
            chalk.red(`Прокси ${proxyUrl} не работает, возможны отказы.`)
          );
        } else {
          logger.info(
            chalk.green(`Прокси ${proxyUrl} живой, будем использовать.`)
          );
        }

        return isProxyWorking;
      } catch (error) {
        logger.error('Критическая ошибка при проверке прокси', { error });
        return false; // Fallback: без прокси
      }
    })();
  }
  return proxyInitPromise;
};

/**
 * Получает кэшированный или создает новый инстанс Axios для поставщика.
 * Безопасно вызывать сразу при старте приложения — дождется прокси сам.
 */
export const getAxiosInstance = async (
  supplierKey: SupplierName
): Promise<AxiosInstance> => {
  // Если инстанс уже создан, отдаем его мгновенно
  if (axiosInstancesCache.has(supplierKey)) {
    return axiosInstancesCache.get(supplierKey)!;
  }

  // ЖДЕМ завершения инициализации прокси (решает проблему гонки!)
  const shouldUseProxy = await initProxyCheck();

  const supplier = suppliers[supplierKey];
  if (!supplier) {
    throw new Error(`No supplier config found for key: ${supplierKey}`);
  }

  let axiosInstance: AxiosInstance;

  if (shouldUseProxy) {
    const proxyAuthPart = PROXY_AUTH ? `${PROXY_AUTH}@` : '';
    const proxyUrl = `http://${proxyAuthPart}${PROXY_HOST}:${PROXY_PORT}`;
    const agent = new HttpsProxyAgent(proxyUrl, { keepAlive: true });

    axiosInstance = axios.create({
      baseURL: supplier.baseUrl,
      httpAgent: agent,
      httpsAgent: agent,
      timeout: 10_000,
    });
    logger.info(`Created proxy Axios instance for: ${supplierKey}`);
  } else {
    axiosInstance = axios.create({
      baseURL: supplier.baseUrl,
      timeout: 10_000,
    });
    logger.info(
      chalk.blue(`Created direct Axios instance for: ${supplierKey}`)
    );
  }

  // Кешируем MD5 пароля один раз при создании инстанса, чтобы не считать на каждый запрос
  const authParams = supplier.needAuth
    ? {
        userlogin: supplier.username,
        userpsw: generateMD5(supplier.password),
      }
    : {};

  axiosRetry(axiosInstance, {
    retries: 2, // Чуть увеличил для надежности
    shouldResetTimeout: true,
    retryDelay: (retryCount) => 1000 * Math.pow(2, retryCount),
    retryCondition: (error: AxiosError) => {
      if (error.code === 'ECONNABORTED') return true;
      if (isNetworkOrIdempotentRequestError(error)) return true;
      return false;
    },
  });

  axiosInstance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      if (!config.headers) config.headers = new AxiosHeaders();
      config.headers.set('Accept-Encoding', 'gzip, deflate');

      if (supplier.needAuth) {
        config.params = { ...config.params, ...authParams };
      }
      return config;
    }
  );

  axiosInstance.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      if (error.code === 'ECONNREFUSED') {
        logger.error(`Connection refused for ${supplierKey} (proxy error)`);
      }
      return Promise.reject(error);
    }
  );

  // Сохраняем в кэш
  axiosInstancesCache.set(supplierKey, axiosInstance);
  return axiosInstance;
};

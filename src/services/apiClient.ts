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
} from '../config/api/config.js';
import { logger } from '../config/logger/index.js';
import { SupplierName } from '../types/index.js';
import { checkProxy } from '../utils/api/checkProxy.js';
import { generateMD5 } from '../utils/generateMD5.js';
import { getLocalIP } from '../utils/getLocalIP.js';

type AxiosInstanceSupplierName = SupplierName | 'turboCarsBN';

// Храним флаг использования прокси в модуле (или в global)
let shouldUseProxy: boolean | null = null;

// Функция-инициализатор (один раз при старте приложения)
export async function initProxyCheck() {
  // 1) Получаем внешний IP
  const localIP = await getLocalIP();

  // 2) Сравниваем с PROXY_HOST
  if (localIP === PROXY_HOST) {
    logger.info(
      `Текущий IP (${localIP}) = PROXY_HOST (${PROXY_HOST}). Прокси использовать не будем.`
    );
    shouldUseProxy = false;
    return;
  }

  // 3) Если IP не совпадает – по умолчанию используем прокси.
  //    Но проверим сразу «жив ли» прокси, если хотите.
  const proxyAuthPart = PROXY_AUTH ? `${PROXY_AUTH}@` : '';
  const proxyUrl = `http://${proxyAuthPart}${PROXY_HOST}:${PROXY_PORT}`;
  const agent = new HttpsProxyAgent(proxyUrl, { keepAlive: true });
  const isProxyWorking = await checkProxy(agent);

  shouldUseProxy = isProxyWorking;
  if (!isProxyWorking) {
    logger.error(
      chalk.red(
        `Прокси ${proxyUrl} не работает, будут отказы в запросах через прокси.`
      )
    );
  } else {
    logger.info(chalk.green(`Прокси ${proxyUrl} живой, будем использовать.`));
  }
}

// Собственно создание axios-инстанса
export const createAxiosInstance = async (
  supplierKey: AxiosInstanceSupplierName
): Promise<AxiosInstance> => {
  // Убедимся, что флаг shouldUseProxy уже определён
  // (значит вы ранее вызвали initProxyCheck)
  if (shouldUseProxy === null) {
    throw new Error(
      'Нельзя создать AxiosInstance до инициализации прокси. Сначала вызовите initProxyCheck()!'
    );
  }

  const supplier = suppliers[supplierKey];
  if (!supplier) {
    throw new Error(`No supplier config found for key: ${supplierKey}`);
  }

  let axiosInstance: AxiosInstance;

  // Если нужно использовать прокси
  if (shouldUseProxy) {
    const proxyAuthPart = PROXY_AUTH ? `${PROXY_AUTH}@` : '';
    const proxyUrl = `http://${proxyAuthPart}${PROXY_HOST}:${PROXY_PORT}`;
    const agent = new HttpsProxyAgent(proxyUrl, { keepAlive: true });

    axiosInstance = axios.create({
      baseURL: supplier.baseUrl,
      httpAgent: agent,
      httpsAgent: agent,
      timeout: 10_000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    logger.info(`Axios instance with proxy for: ${supplierKey}`);
  } else {
    // Создаём без прокси
    axiosInstance = axios.create({
      baseURL: supplier.baseUrl,
      timeout: 10_000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    logger.info(chalk.blue(`Axios instance without proxy for: ${supplierKey}`));
  }

  // Подключаем axios-retry
  axiosRetry(axiosInstance, {
    retries: 1,
    shouldResetTimeout: true,
    retryDelay: (retryCount) => 1000 * Math.pow(2, retryCount),
    retryCondition: (error: AxiosError) => {
      // 1) Таймаут
      if (error.code === 'ECONNABORTED') {
        logger.warn('[axios-retry] Retrying because of timeout...');
        return true;
      }
      // 2) 5xx или сетевые ошибки
      if (isNetworkOrIdempotentRequestError(error)) {
        logger.warn('[axios-retry] Retrying network or 5xx error...');
        return true;
      }
      return false;
    },
  });

  // Интерсептор на запрос
  axiosInstance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      if (!config.headers) {
        config.headers = new AxiosHeaders();
      }
      config.headers.set('Accept-Encoding', 'gzip, deflate');

      // Пример логики для конкретных поставщиков
      if (
        supplierKey === 'ug' ||
        supplierKey === 'patriot' ||
        supplierKey === 'npn'
      ) {
        config.params = {
          ...config.params,
          userlogin: supplier.username,
          userpsw: generateMD5(supplier.password),
        };
      } else if (supplierKey === 'turboCars' || supplierKey === 'turboCarsBN') {
        config.params = {
          ...config.params,
          ClientID: supplier.username,
          Password: supplier.password,
          FromStockOnly: 1,
        };
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Интерсептор на ответ
  axiosInstance.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      if (error.code === 'ECONNREFUSED') {
        logger.error('Connection refused (proxy error)');
        return Promise.reject(new Error('Connection refused (proxy error)'));
      }
      return Promise.reject(error);
    }
  );

  return axiosInstance;
};

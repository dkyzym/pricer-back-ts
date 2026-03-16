import axios, {
  AxiosError,
  AxiosHeaders,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from 'axios';
import axiosRetry, { isNetworkOrIdempotentRequestError } from 'axios-retry';
import chalk from 'chalk';
import { HttpsProxyAgent } from 'https-proxy-agent';
import os from 'os';

import {
  PROXY_AUTH,
  PROXY_HOST,
  PROXY_MODE,
  PROXY_PORT,
  suppliers,
} from '../../config/api/config.js';
import { logger } from '../../config/logger/index.js';

import { SupplierName } from '../../types/common.types.js';
import { generateMD5 } from '../../utils/generateMD5.js';

let proxyInitPromise: Promise<boolean> | null = null;

const axiosInstancesCache = new Map<SupplierName, AxiosInstance>();

/**
 * Проверяет, принадлежит ли IP одному из локальных сетевых интерфейсов.
 * Используется в auto-режиме вместо внешнего api.ipify.org —
 * если PROXY_HOST совпадает с адресом нашей машины, прокси не нужен.
 */
const isLocalIP = (targetIP: string): boolean => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] ?? []) {
      if (iface.address === targetIP) return true;
    }
  }
  return false;
};

/**
 * Определяет необходимость использования прокси.
 *
 * PROXY_MODE (env):
 * - 'off'  — прокси не используется (для машины, где прокси локальный)
 * - 'on'   — прокси используется безусловно
 * - 'auto' — решение по os.networkInterfaces(), без внешних HTTP-запросов
 */
export const initProxyCheck = (): Promise<boolean> => {
  if (!proxyInitPromise) {
    proxyInitPromise = (async () => {
      if (PROXY_MODE === 'off') {
        logger.info('PROXY_MODE=off — прокси не используется.');
        return false;
      }

      if (PROXY_MODE === 'on') {
        logger.info(
          chalk.green(
            `PROXY_MODE=on — прокси ${PROXY_HOST}:${PROXY_PORT} используется принудительно.`
          )
        );
        return true;
      }

      // auto: определяем локально, без обращения к внешним API
      if (isLocalIP(PROXY_HOST)) {
        logger.info(
          `PROXY_HOST (${PROXY_HOST}) найден среди локальных интерфейсов — прокси не нужен.`
        );
        return false;
      }

      logger.info(
        chalk.green(
          `PROXY_HOST (${PROXY_HOST}) не найден локально — будем использовать прокси.`
        )
      );
      return true;
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

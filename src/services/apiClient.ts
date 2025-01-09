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
} from '../config/api/config';
import { SupplierName } from '../types';
import { checkProxy } from '../utils/api/checkProxy';
import { generateMD5 } from '../utils/generateMD5';

type AxiosInstanceSupplierName = SupplierName | 'turboCarsBN';

export const createAxiosInstance = async (
  supplierKey: AxiosInstanceSupplierName
): Promise<AxiosInstance> => {
  const supplier = suppliers[supplierKey];
  if (!supplier)
    throw new Error(`No supplier config found for key: ${supplierKey}`);

  // Настраиваем прокси
  const proxyAuthPart = PROXY_AUTH ? `${PROXY_AUTH}@` : '';
  const proxyUrl = `http://${proxyAuthPart}${PROXY_HOST}:${PROXY_PORT}`;
  const agent = new HttpsProxyAgent(proxyUrl, { keepAlive: true });

  console.log(
    chalk.yellow(`Checking proxy availability for supplier: ${supplierKey}`)
  );
  const isProxyWorking = await checkProxy(agent);

  if (!isProxyWorking) {
    throw new Error('Proxy not available. Requests will not be sent.');
  }

  // Создаём инстанс axios
  const axiosInstance = axios.create({
    baseURL: supplier.baseUrl,
    httpAgent: agent,
    httpsAgent: agent,
    timeout: 15_000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  // Подключаем axios-retry
  axiosRetry(axiosInstance, {
    retries: 2, // сколько раз повторять запрос
    shouldResetTimeout: true,
    retryDelay: (retryCount) => {
      // Простая экспоненциальная задержка
      return 1000 * Math.pow(2, retryCount); // 1s, 2s, 4s...
    },
    retryCondition: (error: AxiosError) => {
      // 1) Проверяем таймаут (код = ECONNABORTED)
      if (error.code === 'ECONNABORTED') {
        console.log(chalk.cyan('[axios-retry] Retrying because of timeout...'));
        return true;
      }
      // 2) Проверяем 5xx (isNetworkOrIdempotentRequestError обрабатывает HTTP >= 500)
      if (isNetworkOrIdempotentRequestError(error)) {
        console.log(
          chalk.cyan('[axios-retry] Retrying network or 5xx error...')
        );
        return true;
      }
      return false;
    },
  });

  // Интерсептор на запрос: добавляем заголовок Accept-Encoding
  axiosInstance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      // Убедимся, что заголовки существуют и типизируем их правильно
      if (!config.headers) {
        config.headers = new AxiosHeaders();
      }

      // Устанавливаем gzip и deflate для Accept-Encoding
      config.headers.set('Accept-Encoding', 'gzip, deflate');

      // Логика для supplierKey === 'ug'
      if (supplierKey === 'ug') {
        config.params = {
          ...config.params,
          userlogin: supplier.username,
          userpsw: generateMD5(supplier.password),
        };
      }
      // Логика для turboCars / turboCarsBN
      else if (supplierKey === 'turboCars' || supplierKey === 'turboCarsBN') {
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

  // Интерсептор на ответ:
  axiosInstance.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      if (error.code === 'ECONNREFUSED') {
        console.error('Connection refused (proxy error)');
        return Promise.reject(new Error('Connection refused (proxy error)'));
      }
      return Promise.reject(error);
    }
  );

  console.log(chalk.green('Axios instance created for supplier:'), supplierKey);
  return axiosInstance;
};

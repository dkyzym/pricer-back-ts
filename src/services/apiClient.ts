import axios, { AxiosError, AxiosInstance } from 'axios';
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

export const createAxiosInstance = async (
  supplierKey: SupplierName
): Promise<AxiosInstance> => {
  const supplier = suppliers[supplierKey];
  if (!supplier)
    throw new Error(`No supplier config found for key: ${supplierKey}`);

  const proxyAuthPart = PROXY_AUTH ? `${PROXY_AUTH}@` : '';
  const proxyUrl = `http://${proxyAuthPart}${PROXY_HOST}:${PROXY_PORT}`;

  const agent = new HttpsProxyAgent(proxyUrl);

  // Проверка прокси
  console.log(
    chalk.yellow(`Checking proxy availability for supplier: ${supplierKey}`)
  );
  const isProxyWorking = await checkProxy(agent);
  if (!isProxyWorking) {
    throw new Error('Proxy not available. Requests will not be sent.');
  }

  const axiosInstance = axios.create({
    baseURL: supplier.baseUrl,
    httpAgent: agent,
    httpsAgent: agent,
    timeout: 10000, // Можно увеличить таймаут для длительных запросов
  });

  axiosInstance.interceptors.request.use(
    (config) => {
      if (supplierKey === 'ug') {
        config.params = {
          ...config.params,
          userlogin: supplier.username,
          userpsw: generateMD5(supplier.password),
        };
      } else if (supplierKey === 'turboCars') {
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

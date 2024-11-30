// apiClient.ts
import axios, { AxiosInstance } from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import {
  PROXY_AUTH,
  PROXY_HOST,
  PROXY_PORT,
  suppliers,
} from '../config/api/config';
import { generateMD5 } from '../utils/generateMD5';
import { SupplierName } from '../types';

const proxyAuthPart = PROXY_AUTH ? `${PROXY_AUTH}@` : '';
const proxyUrl = `http://${proxyAuthPart}${PROXY_HOST}:${PROXY_PORT}`;
const agent = new HttpsProxyAgent(proxyUrl);

export const createAxiosInstance = (
  supplierKey: SupplierName
): AxiosInstance => {
  const supplier = suppliers[supplierKey];

  if (!supplier) {
    throw new Error(
      `Не найдена конфигурация поставщика с ключом: ${supplierKey}`
    );
  }

  const axiosInstance = axios.create({
    baseURL: supplier.baseUrl,
    httpAgent: agent,
    httpsAgent: agent,
  });

  // Перехватчик для добавления параметров аутентификации
  axiosInstance.interceptors.request.use(
    (config) => {
      config.params = {
        ...config.params,
        userlogin: supplier.username,
        userpsw: generateMD5(supplier.password),
      };
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Обработка ошибок прокси
  axiosInstance.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.code === 'ECONNREFUSED') {
        return Promise.reject(new Error('Ошибка подключения к прокси'));
      }
      return Promise.reject(error);
    }
  );

  return axiosInstance;
};

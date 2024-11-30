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
import { generateMD5 } from '../utils/generateMD5';

export const createAxiosInstance = async (
  supplierKey: SupplierName
): Promise<AxiosInstance> => {
  const supplier = suppliers[supplierKey];
  if (!supplier) {
    throw new Error(
      `Не найдена конфигурация поставщика с ключом: ${supplierKey}`
    );
  }

  const proxyAuthPart = PROXY_AUTH ? `${PROXY_AUTH}@` : '';
  const proxyUrl = `http://${proxyAuthPart}${PROXY_HOST}:${PROXY_PORT}`;
  const agent = new HttpsProxyAgent(proxyUrl);

  // Проверка доступности прокси
  const isProxyWorking = await checkProxy(agent);
  if (!isProxyWorking) {
    throw new Error('Прокси недоступен. Запросы не будут отправлены.');
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

// Функция для проверки работы прокси
const checkProxy = async (agent: any) => {
  try {
    const testInstance = axios.create({
      httpAgent: agent,
      httpsAgent: agent,
      timeout: 5000, // Установите тайм-аут для проверки
    });
    const response = await testInstance.get('http://api.ipify.org?format=json');
    console.log(
      chalk.cyan.italic('IP через прокси:', JSON.stringify(response.data))
    );
    return true;
  } catch (error) {
    console.error('Ошибка прокси:', (error as AxiosError).message);
    return false;
  }
};

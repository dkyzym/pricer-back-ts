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

/**
 * createAxiosInstance - Creates an Axios instance configured for a specific supplier.
 * @param supplierKey SupplierName
 * @returns Promise<AxiosInstance>
 */
export const createAxiosInstance = async (
  supplierKey: SupplierName
): Promise<AxiosInstance> => {
  const supplier = suppliers[supplierKey];
  if (!supplier)
    throw new Error(`No supplier config found for key: ${supplierKey}`);

  // Build the proxy URL
  const proxyAuthPart = PROXY_AUTH ? `${PROXY_AUTH}@` : '';
  const proxyUrl = `http://${proxyAuthPart}${PROXY_HOST}:${PROXY_PORT}`;

  // Create a proxy agent
  const agent = new HttpsProxyAgent(proxyUrl);

  // Check if proxy works
  const isProxyWorking = await checkProxy(agent);
  if (!isProxyWorking)
    throw new Error('Proxy not available. Requests will not be sent.');

  const axiosInstance = axios.create({
    baseURL: supplier.baseUrl,
    httpAgent: agent,
    httpsAgent: agent,
  });

  // Request interceptor to add required params
  axiosInstance.interceptors.request.use(
    (config) => {
      // Original logic from your code snippet: appending userlogin and userpsw if needed.
      // If you want different logic for turboCars, you can conditionally handle it based on supplierKey.
      // For backward compatibility, let's keep the old logic.
      if (supplierKey === 'ug') {
        config.params = {
          ...config.params,
          userlogin: supplier.username,
          userpsw: generateMD5(supplier.password),
        };
      } else if (supplierKey === 'turboCars') {
        // For turboCars, we add ClientID, Password as per the given requirements
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

  // Response interceptor for error handling
  axiosInstance.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      if (error.code === 'ECONNREFUSED') {
        return Promise.reject(new Error('Connection refused (proxy error)'));
      }
      return Promise.reject(error);
    }
  );

  console.log(chalk.green('Axios instance created for supplier:'), supplierKey);
  return axiosInstance;
};

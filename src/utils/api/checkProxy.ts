import axios, { AxiosError, AxiosInstance } from 'axios';
import chalk from 'chalk';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { logger } from '../../config/logger/index.js';

interface RetryOptions {
  retries: number;
  delay: number;
}

const defaultRetryOptions: RetryOptions = {
  retries: 3,
  delay: 500,
};

async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = defaultRetryOptions
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < options.retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      logger.warn(
        `Retry ${i + 1} of ${options.retries} failed: ${(error as Error).message}`
      );
      if (i < options.retries - 1) {
        await new Promise((res) => setTimeout(res, options.delay));
      }
    }
  }
  throw lastError;
}

export const checkProxy = async (
  agent: HttpsProxyAgent<string>,
  testUrl = 'https://api.ipify.org?format=json',
  timeout = 5000
): Promise<boolean> => {
  const testInstance: AxiosInstance = axios.create({
    httpAgent: agent,
    httpsAgent: agent,
    timeout,
  });

  try {
    const response = await withRetry(() => testInstance.get(testUrl), {
      retries: 3,
      delay: 2000,
    });

    logger.info(
      chalk.yellow(`IP through proxy: ${JSON.stringify(response.data)}`)
    );

    return true;
  } catch (error) {
    logger.error(
      'Proxy check error after retries:',
      (error as AxiosError).message
    );
    logger.error(
      'Proxy check error after retries:',
      (error as AxiosError).message
    );
    return false;
  }
};

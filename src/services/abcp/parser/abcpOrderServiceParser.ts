import { AxiosResponse } from 'axios';
import { DateTime } from 'luxon';
import { Logger } from 'winston';
import { UnifiedOrderItem } from '../../orders/orders.types.js';
import { AbcpParserFn } from './AbcpOrderParser.js';

// --- Types ---

export interface IAbcpClientWrapper {
  makeRequest: (url: string, options?: any) => Promise<AxiosResponse>;
}

export interface SupplierConfigABCP {
  key: string;
  baseUrl: string;
  queryType: 'flat' | 'nested';
  historyDays?: number;
}

interface ServiceDependencies {
  client: IAbcpClientWrapper;
  parser: AbcpParserFn;
}

// --- Constants ---

const PAGE_SIZE = 20;
const MAX_SAFETY_LIMIT = 10000;
const DELAY_MIN_MS = 300;
const DELAY_MAX_MS = 1000;

// --- Helpers (Pure) ---

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getRandomDelay = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1) + min);

const getDateRangeString = (daysBack: number): string => {
  const now = DateTime.now();
  const start = now.minus({ days: daysBack });
  return `${start.toFormat('dd.MM.yyyy')} - ${now.toFormat('dd.MM.yyyy')}`;
};

const buildParams = (
  config: SupplierConfigABCP,
  dateRange: string,
  start: number
): Record<string, string | number> => {
  const params: Record<string, string | number> = { start };

  if (config.queryType === 'nested') {
    params['filter[dateRange]'] = dateRange;
  } else {
    params['dateRange'] = dateRange;
  }

  return params;
};

const logResponseDebug = (
  html: string,
  supplierKey: string,
  start: number,
  logger: Logger
): void => {
  if (!html) return;

  const isLoginPage =
    html.includes('name="login"') || html.includes('Вход в систему');
  const titleMatch = html.match(/<title>(.*?)<\/title>/i);
  const pageTitle = titleMatch ? titleMatch[1].trim() : 'No Title';

  logger.debug(`[AbcpOrderService] Empty response analysis`, {
    supplier: supplierKey,
    start,
    pageTitle,
    isLoginPage,
    htmlSnippet: html.substring(0, 150).replace(/\s+/g, ' '),
  });
};

// --- Core Logic ---

const fetchSinglePage = async (
  deps: ServiceDependencies,
  config: SupplierConfigABCP,
  start: number,
  dateRange: string,
  logger: Logger
) => {
  try {
    const params = buildParams(config, dateRange, start);
    const response = await deps.client.makeRequest(config.baseUrl, { params });
    const html = response.data;

    const items = deps.parser(html, config.key);
    return { items, html };
  } catch (error) {
    logger.error(
      `[AbcpOrderService] Request failed at start=${start} for ${config.key}`,
      { error }
    );
    return { items: [], html: '' };
  }
};

const fetchPagesRecursive = async (
  deps: ServiceDependencies,
  config: SupplierConfigABCP,
  dateRange: string,
  logger: Logger,
  start: number = 0,
  accumulator: UnifiedOrderItem[] = []
): Promise<UnifiedOrderItem[]> => {
  // 1. Safety Guard
  if (start > MAX_SAFETY_LIMIT) {
    logger.warn(`[AbcpOrderService] Safety limit hit (${MAX_SAFETY_LIMIT})`, {
      supplier: config.key,
    });
    return accumulator;
  }

  // 2. Random Delay (Throttle)
  // Добавляем задержку перед запросом, если это не первая страница.
  // Это снижает нагрузку на сервер поставщика и риск бана.
  if (start > 0) {
    const waitTime = getRandomDelay(DELAY_MIN_MS, DELAY_MAX_MS);
    await delay(waitTime);
  }

  // 3. Fetch & Parse
  const { items, html } = await fetchSinglePage(
    deps,
    config,
    start,
    dateRange,
    logger
  );

  // 4. Stop Conditions
  if (items.length === 0) {
    logResponseDebug(html, config.key, start, logger);
    return accumulator;
  }

  // Оптимизация: если элементов меньше страницы, значит это конец
  if (items.length < PAGE_SIZE) {
    return [...accumulator, ...items];
  }

  // 5. Recursive Step
  return fetchPagesRecursive(
    deps,
    config,
    dateRange,
    logger,
    start + PAGE_SIZE,
    [...accumulator, ...items]
  );
};

// --- Main Factory ---

/**
 * Фабрика сервиса. Заменяет класс abcpOrderServiceParser.
 * Принимает зависимости (Client, Parser) и возвращает методы работы с ними.
 */
export const createAbcpOrderService = (
  client: IAbcpClientWrapper,
  parser: AbcpParserFn
) => {
  const syncSupplier = async (
    config: SupplierConfigABCP,
    logger: Logger
  ): Promise<UnifiedOrderItem[]> => {
    const daysBack = config.historyDays ?? 60;
    const dateRange = getDateRangeString(daysBack);

    logger.debug(`[AbcpOrderService] Syncing ${config.key}`, {
      supplier: config.key,
      daysBack,
      range: dateRange,
    });

    try {
      const orders = await fetchPagesRecursive(
        { client, parser },
        config,
        dateRange,
        logger
      );

      logger.info(
        `[AbcpOrderService] Fetched ${orders.length} items from ${config.key}`,
        { supplier: config.key, count: orders.length }
      );

      return orders;
    } catch (error) {
      logger.error(`[AbcpOrderService] Failed to sync ${config.key}`, {
        supplier: config.key,
        error,
      });
      throw error;
    }
  };

  return { syncSupplier };
};

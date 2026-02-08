import { DateTime } from 'luxon';
import { Logger } from 'winston';
import { AxiosResponse } from 'axios';
import { AbcpOrderParser } from './AbcpOrderParser.js';
import { UnifiedOrderItem } from '../../orders/orders.types.js';

// Интерфейс обертки клиента
export interface IAbcpClientWrapper {
  makeRequest: (url: string, options?: any) => Promise<AxiosResponse>;
}

export interface SupplierConfigABCP {
  key: string;
  baseUrl: string;
  queryType: 'flat' | 'nested';
  historyDays?: number;
}

export class abcpOrderServiceParser {
  constructor(
    private readonly client: IAbcpClientWrapper,
    private readonly parser: AbcpOrderParser
  ) {}

  public async syncSupplier(
    config: SupplierConfigABCP,
    logger: Logger
  ): Promise<UnifiedOrderItem[]> {
    const daysBack = config.historyDays ?? 60;
    const dateRange = this.getDateRangeString(daysBack);

    logger.debug(
      `[AbcpOrderService] Syncing ${config.key}. Range: ${dateRange}`,
      { supplier: config.key, daysBack }
    );

    try {
      const orders = await this.fetchAll(config, dateRange, logger);

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
  }

  private async fetchAll(
    config: SupplierConfigABCP,
    dateRangeStr: string,
    logger: Logger
  ): Promise<UnifiedOrderItem[]> {
    const allItems: UnifiedOrderItem[] = [];
    const PAGE_SIZE = 20;
    let start = 0;
    let hasMore = true;

    const params: Record<string, string | number> = {};
    if (config.queryType === 'nested') {
      params['filter[dateRange]'] = dateRangeStr;
    } else {
      params['dateRange'] = dateRangeStr;
    }

    while (hasMore) {
      try {
        const response = await this.client.makeRequest(config.baseUrl, {
          params: { ...params, start: start },
        });

        const html = response.data;

        // --- NETS: DEBUGGING HTML CONTENT (Временно для отладки) ---
        // @ts-ignore
        const finalUrl = response.request?.res?.responseUrl || config.baseUrl;
        const titleMatch = html.match(/<title>(.*?)<\/title>/i);
        const pageTitle = titleMatch ? titleMatch[1] : 'No Title Found';

        logger.debug(
          `[AbcpOrderService DEBUG] Response Analysis for ${config.key}`,
          {
            startParam: start,
            finalUrl, // Важно! Видим, не редиректнуло ли нас
            pageTitle: pageTitle.trim(),
            htmlLength: html.length,
            isLoginPage:
              html.includes('name="login"') || html.includes('Вход в систему'),
            hasOrdersClass: html.includes('allOrdersOrder'),
            // Первые 200 символов, чтобы увидеть DOCTYPE или ошибку
            snippet: html.substring(0, 200).replace(/\s+/g, ' '),
          }
        );
        // -----------------------------------------------------------

        const parsedItems = this.parser.parse(html, config.key);

        if (parsedItems.length === 0) {
          // Если 0 элементов, но мы ожидали их, лог выше подскажет почему
          logger.warn(
            `[AbcpOrderService] Parsed 0 items. check DEBUG logs above.`,
            { supplier: config.key }
          );
          hasMore = false;
        } else {
          allItems.push(...parsedItems);
          start += PAGE_SIZE;

          if (start > 10000) {
            logger.warn(
              `[AbcpOrderService] Hit safety limit for ${config.key}`,
              { start }
            );
            hasMore = false;
          }
        }
      } catch (error) {
        logger.error(
          `[AbcpOrderService] Error fetching page start=${start} for ${config.key}`,
          { error }
        );
        hasMore = false;
      }
    }

    return allItems;
  }

  private getDateRangeString(daysBack: number): string {
    const now = DateTime.now();
    const start = now.minus({ days: daysBack });
    const fmt = 'dd.MM.yyyy';
    return `${start.toFormat(fmt)} - ${now.toFormat(fmt)}`;
  }
}

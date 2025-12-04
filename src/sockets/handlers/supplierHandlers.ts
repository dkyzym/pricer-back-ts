import { Logger } from 'winston';
import {
  getItemResultsParams,
  SupplierHandler,
} from '../../types/search.types.js';

// --- Импорты бизнес-логики ---
// ABCP (API)
import {
  avtodinamikaConfig,
  npnConfig,
  patriotConfig,
  ugConfig,
} from '../../services/abcp/abcp.configs.js';
import { AbcpSupplierAlias } from '../../services/abcp/abcpPlatform.types.d.js';
import { mapAbcpResponse } from '../../services/abcp/abcpResponseMapper.js';
import { fetchAbcpData } from '../../services/abcp/api/fetchAbcpData.js';

// ABCP (Парсеры)
import {
  autoImpulseClient,
  mikanoClient,
} from '../../services/abcp/parser/index.js';

// Profit
import { getItemsListByArticleService } from '../../services/profit/getItemsListByArticleService.js';
import { getItemsWithRest } from '../../services/profit/getItemsWithRest.js';
import { parseProfitApiResponse } from '../../services/profit/parseProfitApiResponse.js';

// Armtek
import { parseArmtekResults } from '../../services/armtek/parseArmtekResults.js';
import { searchArmtekArticle } from '../../services/armtek/searchArmtekArticle.js';
import { getCachedStoreList } from '../../services/armtek/storeList.js';

// Autosputnik
import { parseAutosputnikData } from '../../services/autosputnik/parseAutosputnikData.js';

// AvtoPartner
import { itemDataAvtoPartnerService } from '../../services/avtopartner/itemDataAvtoPartnerService.js';

// Общие утилиты
import { createAbcpError } from '../../utils/abcpErrorHandler.js';
import { isRelevantBrand } from '../../utils/data/brand/isRelevantBrand.js';
import {
  isBrtBrand,
  transformArticleByBrand,
} from '../../utils/data/brand/transformArticleByBrand.js';

/**
 * Единая карта обработчиков для всех поставщиков.
 */
export const supplierHandlers: Record<string, SupplierHandler> = {
  // --- Поставщики на API ABCP ---
  ug: createAbcpApiHandler(ugConfig, ['ug']),
  ug_f: createAbcpApiHandler(ugConfig, ['ug_f']),
  ug_bn: createAbcpApiHandler(ugConfig, ['ug_bn']),
  patriot: createAbcpApiHandler(patriotConfig, ['patriot']),
  npn: createAbcpApiHandler(npnConfig, ['npn']),
  avtodinamika: createAbcpApiHandler(avtodinamikaConfig, ['avtodinamika']),

  // --- Поставщики-парсеры ABCP (Refactored) ---
  // Теперь здесь чисто: логика ретрая спрятана внутри фабрики
  autoImpulse: createParserHandlerWithRetry(autoImpulseClient),
  mikano: createParserHandlerWithRetry(mikanoClient),

  // --- Profit ---
  profit: async (data, userLogger) => {
    const { item, supplier } = data;
    const articleToSearch = transformArticleByBrand(
      item.article,
      item.brand,
      supplier
    );
    const items = await getItemsListByArticleService(articleToSearch);
    const itemsWithRest = await getItemsWithRest(items, userLogger);
    const relevantItems = itemsWithRest.filter(({ brand }: any) =>
      isRelevantBrand(item.brand, brand)
    );
    return parseProfitApiResponse(relevantItems, item.brand, userLogger);
  },

  // --- Armtek ---
  armtek: async (data, userLogger) => {
    const { item, supplier } = data;
    const articleToSearch = transformArticleByBrand(
      item.article,
      item.brand,
      supplier
    );
    const { RESP } = await searchArmtekArticle(
      { PIN: articleToSearch },
      userLogger
    );
    if (!RESP || !RESP.length) return [];
    const relevantItems = RESP.filter((resItem) =>
      isRelevantBrand(item.brand, resItem.BRAND || '')
    );
    const storeList = await getCachedStoreList();
    return parseArmtekResults(relevantItems, storeList);
  },

  // --- Autosputnik ---
  autosputnik: (data, userLogger) => {
    const { item, supplier } = data;
    if (supplier === 'autosputnik' || supplier === 'autosputnik_bn') {
      return parseAutosputnikData(item, userLogger, supplier);
    }
    throw new Error(`Invalid supplier for Autosputnik handler: ${supplier}`);
  },
  autosputnik_bn: (data, userLogger) => {
    const { item, supplier } = data;
    if (supplier === 'autosputnik' || supplier === 'autosputnik_bn') {
      return parseAutosputnikData(item, userLogger, supplier);
    }
    throw new Error(`Invalid supplier for Autosputnik handler: ${supplier}`);
  },

  // --- AvtoPartner ---
  avtoPartner: (data, userLogger) => {
    return itemDataAvtoPartnerService({ ...data, userLogger });
  },
};

// =========================================================================
//                             FACTORIES & HELPERS
// =========================================================================

/**
 * Фабрика для парсеров с поддержкой "умного ретрая" для БРТ.
 * Устраняет дублирование кода между mikano и autoImpulse.
 */
function createParserHandlerWithRetry(client: any): SupplierHandler {
  return async (data, userLogger) => {
    // 1. Первая попытка: ищем как есть
    const results = await client.searchItem({ ...data, userLogger });

    // 2. Логика ретрая: Если пусто, бренд БРТ и артикул кончается на цифру
    if (
      results.length === 0 &&
      isBrtBrand(data.item.brand) &&
      /[0-9]$/.test(data.item.article)
    ) {
      userLogger.info(
        `[${data.supplier}] No results. Retrying with suffix 'Р'...`
      );

      const retryData = {
        ...data,
        item: {
          ...data.item,
          article: data.item.article + 'Р', // Добавляем кириллическую Р
        },
      };

      return client.searchItem({ ...retryData, userLogger });
    }

    return results;
  };
}

/**
 * Вспомогательная функция-фабрика для создания хендлеров ABCP API.
 */
function createAbcpApiHandler(
  config: any,
  allowedSuppliers: AbcpSupplierAlias[]
): SupplierHandler {
  return async (data: getItemResultsParams, userLogger: Logger) => {
    const { item, supplier } = data;

    if (!allowedSuppliers.includes(supplier as any)) {
      throw new Error(`Invalid supplier ${supplier} for this handler.`);
    }

    try {
      const useOnlineStocks = ['ug_f', 'ug_bn'].includes(supplier)
        ? 0
        : supplier === 'ug'
          ? 1
          : undefined;

      const articleToSearch = transformArticleByBrand(
        item.article,
        item.brand,
        supplier
      );

      const responseData = await fetchAbcpData(
        articleToSearch,
        item.brand,
        supplier as AbcpSupplierAlias,
        useOnlineStocks
      );
      return mapAbcpResponse(
        responseData,
        item.brand,
        userLogger,
        supplier as AbcpSupplierAlias,
        config
      );
    } catch (error) {
      throw createAbcpError(error, supplier, userLogger);
    }
  };
}

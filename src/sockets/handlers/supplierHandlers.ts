import { Logger } from 'winston';
import {
  getItemResultsParams,
  SupplierHandler,
} from '../../types/search.types.js';

// --- Импорты бизнес-логики НАПРЯМУЮ из сервисов и утилит ---

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
import { autoImpulseClient, mikanoClient } from '../../services/abcp/parser/index.js';

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

/**
 * Единая карта обработчиков для всех поставщиков.
 * Логика из папки `src/sockets/handlers/suppliers/` теперь находится здесь
 * в виде анонимных функций, которые напрямую вызывают сервисы.
 */
export const supplierHandlers: Record<string, SupplierHandler> = {
  // --- Поставщики на API ABCP ---
  ug: createAbcpApiHandler(ugConfig, ['ug']),
  ug_f: createAbcpApiHandler(ugConfig, ['ug_f']),
  ug_bn: createAbcpApiHandler(ugConfig, ['ug_bn']),
  patriot: createAbcpApiHandler(patriotConfig, ['patriot']),
  npn: createAbcpApiHandler(npnConfig, ['npn']),
  avtodinamika: createAbcpApiHandler(avtodinamikaConfig, ['avtodinamika']),

  // --- Поставщики-парсеры ABCP ---
  autoImpulse: (data, userLogger) => {
    return autoImpulseClient.searchItem({ ...data, userLogger });
  },
  mikano: (data, userLogger) => {
    return mikanoClient.searchItem({ ...data, userLogger });
  },

  // --- Profit ---
  profit: async (data, userLogger) => {
    const { item } = data;
    const items = await getItemsListByArticleService(item.article);
    const itemsWithRest = await getItemsWithRest(items, userLogger);
    const relevantItems = itemsWithRest.filter(({ brand }: any) =>
      isRelevantBrand(item.brand, brand)
    );
    return parseProfitApiResponse(relevantItems, item.brand, userLogger);
  },

  // --- Armtek ---
  armtek: async (data, userLogger) => {
    const { item } = data;
    const { RESP } = await searchArmtekArticle({ PIN: item.article }, userLogger);
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

/**
 * Вспомогательная функция-фабрика для создания хендлеров ABCP API.
 * Это позволяет избежать дублирования try/catch и логики вызова.
 */
function createAbcpApiHandler(
  config: any, // Используем any для гибкости конфигов
  allowedSuppliers: (AbcpSupplierAlias)[]
): SupplierHandler {
  return async (data: getItemResultsParams, userLogger: Logger) => {
    const { item, supplier } = data;

    if (!allowedSuppliers.includes(supplier as any)) {
      throw new Error(`Invalid supplier ${supplier} for this handler.`);
    }

    try {
      // Для UG определяем useOnlineStocks, для остальных - undefined (по умолчанию)
      const useOnlineStocks = (['ug_f', 'ug_bn'].includes(supplier)) ? 0 : (supplier === 'ug' ? 1 : undefined);

      const responseData = await fetchAbcpData(
        item.article,
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

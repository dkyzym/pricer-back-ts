import { logger } from '../../../config/logger/index.js';
import { abcpHeaders } from '../../../constants/headers.js';
import { cleanArticleString } from '../../../utils/data/brand/cleanArticleString.js';
import { yieldToEventLoop } from '../../../utils/yieldToEventLoop.js';
import type {
  ABCP_API_CartResponse,
  BasketPositionUG,
} from '../../cart/cart.types.js';
import { parseAddToCartData } from './abcpCartParser.js';
import { autoImpulseClient, mikanoClient } from './index.js';

type AbcpClient = ReturnType<typeof import('./abcpClientParser.js').createAbcpClientParser>;

/** Маппинг имени поставщика → синглтон-клиент из index.ts */
const clientMap: Record<string, AbcpClient> = {
  mikano: mikanoClient,
  autoImpulse: autoImpulseClient, // ИСПРАВЛЕНО: регистр ключа совпадает с cartHandlers.ts
};

const resolveClient = (supplierName: string): AbcpClient => {
  const client = clientMap[supplierName];
  if (!client) {
    throw new Error(`ABCP-клиент для поставщика «${supplierName}» не найден`);
  }
  return client;
};

/**
 * Последовательно добавляет список позиций в корзину ABCP-поставщика.
 *
 * Поток:
 * positions[] → for-of (sequential, rate-limit safe)
 * → GET /search/{brand}/{number}  (получаем HTML с параметрами корзины)
 * → parseAddToCartData            (cheerio → hidden inputs)
 * → POST /?page=addToBasket       (x-www-form-urlencoded)
 * → проверка { status: "ok" }
 * → ABCP_API_CartResponse
 */
export const addAbcpCartParser = async (
  positions: BasketPositionUG[],
  supplierName: string
): Promise<ABCP_API_CartResponse> => {
  const client = resolveClient(supplierName);
  const { baseUrl } = client.config;

  const resultPositions: ABCP_API_CartResponse['positions'] = [];

  for (const position of positions) {
    try {
      const cleanUrlNumber = cleanArticleString(position.number);
      const searchUrl = `${baseUrl}/search/${encodeURIComponent(position.brand)}/${encodeURIComponent(cleanUrlNumber)}`;

      const response = await client.makeRequest(searchUrl, { headers: abcpHeaders });

      await yieldToEventLoop();

      const parsedData = parseAddToCartData(
        response.data,
        position.number,
        position.brand,
        position.supplierCode
      );

      const payload = new URLSearchParams({
        page: 'addToBasket',
        searchResultUniqueId: parsedData.searchResultUniqueId,
        distributorRouteId: parsedData.distributorRouteId,
        number: parsedData.parsedNumber,
        numberFix: parsedData.parsedNumberFix,
        brand: parsedData.parsedBrand,
        quantity: position.quantity.toString(),
        dataSetKey: parsedData.dataSetKey,
        searchNumber: parsedData.parsedNumber,
        searchBrand: parsedData.parsedBrand,
        weightFromApi: parsedData.weight,
        tradeGuardOffers: '[]',
      });

      const postUrl = `${baseUrl}/?page=addToBasket`;
      const payloadStr = payload.toString();

      const postResponse = await client.makePostRequest(postUrl, payloadStr, {
        headers: {
          ...abcpHeaders,
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': searchUrl,
        },
      });

      if (postResponse.data?.status !== 'ok') {
        throw new Error(
          `Неожиданный ответ от API: ${JSON.stringify(postResponse.data)}`
        );
      }

      resultPositions.push({
        number: position.number,
        brand: position.brand,
        supplierCode: position.supplierCode,
        quantity: position.quantity.toString(),
        numberFix: position.number,
        deadline: 0,
        deadlineMax: 0,
        description: '',
        status: 1,
      });
    } catch (error: any) {
      logger.error(
        `[${supplierName}] Ошибка добавления в корзину: ` +
          `${position.brand} / ${position.number} — ${error.message}`
      );

      resultPositions.push({
        number: position.number,
        brand: position.brand,
        supplierCode: position.supplierCode,
        quantity: position.quantity.toString(),
        numberFix: position.number,
        deadline: 0,
        deadlineMax: 0,
        description: '',
        status: 0,
        errorMessage: error.message ?? 'Неизвестная ошибка',
      });
    }
  }

  const hasSuccess = resultPositions.some((p) => p.status === 1);

  return {
    status: hasSuccess ? 1 : 0,
    positions: resultPositions,
  };
};
import axios, { AxiosError } from 'axios';

import { Logger } from 'winston';
import {
  ArmtekSearchRawResponse,
  ArmtekSearchResponse,
  SearchRequest,
  SearchResponseItem,
  SearchWsResponseBody,
} from './armtek.types.js';

/**
 * Базовый URL из ARMTEK_BASE_URL (.env), без завершающего «/».
 */
const ARMTEK_BASE_URL =
  process.env.ARMTEK_BASE_URL?.trim().replace(/\/+$/, '');
/**
 * Ожидание ответа Armtek (мс). Меньше клиентского таймаута в useSocketManager (25 с).
 */
const ARMTEK_SEARCH_TIMEOUT_MS = 20_000;

const normalizeSearchResp = (
  resp: SearchResponseItem[] | SearchWsResponseBody | undefined
): SearchResponseItem[] => {
  if (!resp) return [];
  if (Array.isArray(resp)) return resp;
  return resp.ARRAY ?? [];
};

const formatArmtekMessages = (
  messages: ArmtekSearchRawResponse['MESSAGES'] | undefined
): string => {
  const critical =
    messages?.filter((m) => m.TYPE === 'A' || m.TYPE === 'E') ?? [];
  if (critical.length === 0) return '';
  return critical.map((m) => m.TEXT).join('; ');
};

const isAxiosTimeout = (error: AxiosError): boolean =>
  error.code === 'ECONNABORTED' ||
  error.message.toLowerCase().includes('timeout');

/**
 * Поиск артикула Armtek (`ws_search/search`), тело — JSON.
 */
export async function searchArmtekArticle(
  params: SearchRequest,
  userLogger: Logger
): Promise<ArmtekSearchResponse<SearchResponseItem>> {
  const {
    VKORG = '4000',
    KUNNR_RG = '43054443',
    PIN,
    BRAND = '',
    QUERY_TYPE = '1',
    PROGRAM = 'LP',
    KUNNR_ZA = '',
    INCOTERMS = '',
    VBELN = '',
  } = params;

  const jsonBody = {
    VKORG,
    KUNNR_RG,
    PIN,
    BRAND,
    QUERY_TYPE,
    PROGRAM,
    KUNNR_ZA,
    INCOTERMS,
    VBELN,
  };

  const url = `${ARMTEK_BASE_URL}/api/ws_search/search?format=json`;

  try {
    const response = await axios.post<ArmtekSearchRawResponse>(
      url,
      jsonBody,
      {
        timeout: ARMTEK_SEARCH_TIMEOUT_MS,
        headers: {
          'Content-Type': 'application/json',
        },
        auth: {
          username: process.env.ARMTEK_USERNAME || '',
          password: process.env.ARMTEK_PASSWORD || '',
        },
      }
    );

    const data = response.data;

    if (data.STATUS !== 200) {
      const msg = formatArmtekMessages(data.MESSAGES);
      userLogger.error(
        `[ArmtekSearch] STATUS ${data.STATUS}${msg ? `: ${msg}` : ''}`
      );
      throw new Error(msg || `Armtek search: STATUS ${data.STATUS}`);
    }

    const rows = normalizeSearchResp(data.RESP);

    return {
      STATUS: data.STATUS,
      MESSAGES: data.MESSAGES,
      RESP: rows,
    };
  } catch (error: unknown) {
    if (error instanceof Error && error.message.startsWith('Armtek search:')) {
      throw error;
    }

    const baseHint = ARMTEK_BASE_URL;

    if (error instanceof AxiosError) {
      if (isAxiosTimeout(error)) {
        userLogger.error(
          `[ArmtekSearch] Таймаут ${ARMTEK_SEARCH_TIMEOUT_MS} мс (${baseHint})`
        );
      } else {
        userLogger.error(
          `[ArmtekSearch] ${error.message}${error.response?.status != null ? ` HTTP ${error.response.status}` : ''}`
        );
      }
    } else {
      userLogger.error('[ArmtekSearch]', { error });
    }

    const fromAxios =
      error instanceof AxiosError
        ? (() => {
            if (isAxiosTimeout(error)) {
              return `таймаут ${ARMTEK_SEARCH_TIMEOUT_MS} мс (${baseHint})`;
            }
            const d = error.response?.data as ArmtekSearchRawResponse | undefined;
            const apiText = d ? formatArmtekMessages(d.MESSAGES) : '';
            if (apiText) return apiText;
            if (error.response?.status === 401) {
              return 'HTTP 401: проверьте ARMTEK_USERNAME / ARMTEK_PASSWORD';
            }
            return (
              (typeof error.response?.data === 'string'
                ? error.response.data
                : null) || error.message
            );
          })()
        : String(error);

    throw new Error(
      `Ошибка при выполнении запроса к Armtek: ${fromAxios}`
    );
  }
}

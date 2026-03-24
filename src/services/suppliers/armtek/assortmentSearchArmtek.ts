import axios, { AxiosError } from 'axios';

import { Logger } from 'winston';
import {
  ArmtekAssortmentApiResponse,
  AssortmentSearchItem,
  AssortmentSearchRequest,
} from './armtek.types.js';

const ARMTEK_BASE_URL =
  process.env.ARMTEK_BASE_URL?.trim().replace(/\/+$/, '');

/**
 * Поиск по ассортименту Armtek (assortment_search).
 * Возвращает массив вариантов (бренд, артикул, наименование) по артикулу.
 */
export async function assortmentSearchArmtek(
  params: AssortmentSearchRequest,
  userLogger: Logger
): Promise<AssortmentSearchItem[]> {
  const { VKORG = '4000', PIN, PROGRAM = 'LP' } = params;

  try {
    const response = await axios.post<ArmtekAssortmentApiResponse>(
      `${ARMTEK_BASE_URL}/api/ws_search/assortment_search?format=json`,
      { VKORG, PIN, PROGRAM },
      {
        headers: { 'Content-Type': 'application/json' },
        auth: {
          username: process.env.ARMTEK_USERNAME || '',
          password: process.env.ARMTEK_PASSWORD || '',
        },
      }
    );

    const data = response.data;
    if (data.STATUS !== 200) {
      const errors =
        data.MESSAGES?.filter((m) => m.TYPE === 'A' || m.TYPE === 'E') ?? [];
      userLogger.warn(
        `Armtek assortment_search STATUS ${data.STATUS}: ${errors.map((e) => e.TEXT).join('; ')}`
      );
      return [];
    }

    const items = data.RESP?.ARRAY ?? [];
    return items;
  } catch (error) {
    if (error instanceof AxiosError) {
      userLogger.warn(`Armtek assortment_search: ${error.message}`);
    } else {
      userLogger.warn('Armtek assortment_search:', { error });
    }
    return [];
  }
}

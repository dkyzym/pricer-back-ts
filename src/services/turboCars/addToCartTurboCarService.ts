import { AxiosError } from 'axios';
import { XMLParser } from 'fast-xml-parser';
import iconv from 'iconv-lite';
import { TURBOCARS_SERVICE_PATHS } from '../../config/api/config.js';
import { AddResultXML, BasketPositionTurboCars } from '../../types/index.js';
import { createAxiosInstance } from '../apiClient.js';

export const addToCartTurboCarService = async (
  params: BasketPositionTurboCars
) => {
  try {
    const turboCarsInstanceKey =
      params.nal === true ? 'turboCars' : 'turboCarsBN';

    const api = await createAxiosInstance(turboCarsInstanceKey);
    const response = await api.get<ArrayBuffer>(
      TURBOCARS_SERVICE_PATHS.Basket_Add,
      {
        params,
        responseType: 'arraybuffer',
      }
    );

    // 1. Декодируем (предполагаем windows-1251)
    const decodedHtml = iconv.decode(Buffer.from(response.data), 'win1251');

    const parser = new XMLParser({
      ignoreAttributes: false,
      removeNSPrefix: true, // убираем префиксы пространств имён, если мешают
    });

    const parsed = parser.parse(decodedHtml) as AddResultXML;

    return parsed;
  } catch (error) {
    console.error(
      'Ошибка при добавлении в корзину TurboCars:',
      (error as AxiosError).message
    );
    throw error;
  }
};

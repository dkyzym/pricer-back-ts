import axios from 'axios';
// import { DateTime } from 'luxon';
import { Logger } from 'winston';
import {
  AutosputnikAuthResponse,
  AutosputnikGetBrandsResponse,
  AutosputnikGetProductsResponse,
} from './autosputnik.types.js';

const BASE_URL = 'https://newapi.auto-sputnik.ru';

// ИЗМЕНЕНИЕ: Используем Map для хранения токенов под каждого поставщика отдельно
// Key: 'autosputnik' | 'autosputnik_bn', Value: token
const tokenCache = new Map<string, string>();

async function getToken(
  supplier: 'autosputnik' | 'autosputnik_bn'
): Promise<string> {
  // Проверяем наличие токена конкретно для этого поставщика
  if (tokenCache.has(supplier)) {
    return tokenCache.get(supplier)!;
  }

  const login =
    supplier === 'autosputnik'
      ? process.env.AUTOSPUTNIK_LOGIN
      : process.env.AUTOSPUTNIK_LOGIN_BN;

  const password =
    supplier === 'autosputnik'
      ? process.env.AUTOSPUTNIK_PASS
      : process.env.AUTOSPUTNIK_PASS_BN;

  if (!login || !password) {
    throw new Error(`Missing credentials in env for supplier: ${supplier}`);
  }

  try {
    const { data } = await axios.post<AutosputnikAuthResponse>(
      `${BASE_URL}/users/login`,
      { login, password }
    );

    if (data.error || !data.token) {
      throw new Error(`Auth failed: ${data.error}`);
    }

    // Сохраняем токен в Map с привязкой к поставщику
    tokenCache.set(supplier, data.token);

    return data.token;
  } catch (error) {
    throw new Error(
      `Autosputnik Login Error (${supplier}): ${error instanceof Error ? error.message : error}`
    );
  }
}

export const getAutosputnikBrands = async (
  article: string,
  userLogger: Logger,
  supplier: 'autosputnik' | 'autosputnik_bn'
): Promise<AutosputnikGetBrandsResponse> => {
  try {
    const token = await getToken(supplier);

    const response = await axios.get<AutosputnikGetBrandsResponse>(
      `${BASE_URL}/products/getbrands`,
      {
        params: { articul: article, displaycountproduct: true },
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    return response.data;
  } catch (error) {
    // Если ошибка 401, удаляем токен именно этого поставщика
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      tokenCache.delete(supplier);
      userLogger.warn(`Token invalid for ${supplier}, cache cleared.`);
    }
    userLogger.error('Error fetching Autosputnik brands:', error);
    return { error: 'Fetch error', data: [] };
  }
};

export const getAutosputnikProducts = async (
  article: string,
  brandName: string,
  userLogger: Logger,
  supplier: 'autosputnik' | 'autosputnik_bn'
): Promise<AutosputnikGetProductsResponse> => {
  try {
    const token = await getToken(supplier);

    // НАСТРОЙКИ ПОИСКА
    const payload = {
      articul: article,
      brand: brandName,
      analogi: false,
      tranzit: true,
    };

    const response = await axios.post<AutosputnikGetProductsResponse>(
      `${BASE_URL}/products/getproducts`,
      payload,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    return response.data;
  } catch (error) {
    // Если ошибка 401, удаляем токен именно этого поставщика
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      tokenCache.delete(supplier);
      userLogger.warn(`Token invalid for ${supplier}, cache cleared.`);
    }
    userLogger.error(`Error fetching products for brand ${brandName}:`, error);
    return { error: 'Fetch error', data: [] };
  }
};

// /**
//  * ТЕСТОВАЯ ФУНКЦИЯ ДЛЯ ПРОВЕРКИ ЗАКАЗОВ
//  * Вызывает POST /order/get
//  */
// export const checkAutosputnikOrders = async (
//   userLogger: Logger,
//   supplier: 'autosputnik' | 'autosputnik_bn'
// ) => {
//   try {
//     const token = await getToken(supplier);

//     // 1. Берем интервал за последние 30 дней, чтобы точно что-то найти
//     const dateStart = DateTime.now().minus({ days: 30 }).startOf('day').toISO();
//     const dateEnd = DateTime.now().endOf('day').toISO();

//     const payload = {
//       date_start: dateStart,
//       date_end: dateEnd,
//       orderid: 0, // 0 = все заказы
//       page: 1, // Первая страница
//       pageSize: 50, // Берем 50 штук
//     };

//     console.log(`\n=== [DEBUG START] Requesting Orders for ${supplier} ===`);
//     console.log('Payload:', JSON.stringify(payload, null, 2));

//     const response = await axios.post(`${BASE_URL}/order/get`, payload, {
//       headers: { Authorization: `Bearer ${token}` },
//     });

//     console.log('--- RESPONSE STATUS:', response.status);
//     // Логируем весь ответ целиком, чтобы глазами проверить наличие web-заказов
//     console.log('--- RESPONSE DATA:\n', JSON.stringify(response.data, null, 2));
//     console.log('=== [DEBUG END] ===\n');

//     return response.data;
//   } catch (error) {
//     console.error(`!!! [DEBUG ERROR] ${supplier} !!!`);
//     if (axios.isAxiosError(error)) {
//       console.error('Status:', error.response?.status);
//       console.error('Data:', JSON.stringify(error.response?.data, null, 2));
//     } else {
//       console.error(error);
//     }
//     // Сбрасываем токен, если ошибка авторизации
//     if (axios.isAxiosError(error) && error.response?.status === 401) {
//       tokenCache.delete(supplier);
//     }
//   }
// };

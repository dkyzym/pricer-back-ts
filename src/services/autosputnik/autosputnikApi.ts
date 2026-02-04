import axios from 'axios';
import { Logger } from 'winston';
import {
  AutosputnikAuthResponse,
  AutosputnikGetBrandsResponse,
  AutosputnikGetProductsResponse,
} from './autosputnik.types.js';

export const BASE_URL = 'https://newapi.auto-sputnik.ru';

// Используем Map для хранения токенов под каждого поставщика отдельно
// Key: 'autosputnik' | 'autosputnik_bn', Value: token
export const tokenCache = new Map<string, string>();

export async function getToken(
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

import axios from 'axios';
import { Logger } from 'winston';
import {
  AutosputnikAuthResponse,
  AutosputnikGetBrandsResponse,
  AutosputnikGetProductsResponse,
} from './autosputnik.types.js';

const BASE_URL = 'https://newapi.auto-sputnik.ru';

// Кэш токена
let cachedToken: string | null = null;

async function getToken(
  supplier: 'autosputnik' | 'autosputnik_bn'
): Promise<string> {
  if (cachedToken) return cachedToken;

  const login =
    supplier === 'autosputnik'
      ? process.env.AUTOSPUTNIK_LOGIN
      : process.env.AUTOSPUTNIK_LOGIN_BN;

  const password =
    supplier === 'autosputnik'
      ? process.env.AUTOSPUTNIK_PASS
      : process.env.AUTOSPUTNIK_PASS_BN;

  if (!login || !password) {
    throw new Error('Missing AUTOSPUTNIK credentials in env');
  }

  try {
    const { data } = await axios.post<AutosputnikAuthResponse>(
      `${BASE_URL}/users/login`,
      { login, password }
    );

    if (data.error || !data.token) {
      throw new Error(`Auth failed: ${data.error}`);
    }

    cachedToken = data.token;
    return data.token;
  } catch (error) {
    throw new Error(
      `Autosputnik Login Error: ${error instanceof Error ? error.message : error}`
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
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      cachedToken = null;
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
    console.log('response.data', JSON.stringify(response.data.data[0]));

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      cachedToken = null;
    }
    userLogger.error(`Error fetching products for brand ${brandName}:`, error);
    return { error: 'Fetch error', data: [] };
  }
};

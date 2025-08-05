import dotenv from 'dotenv';

dotenv.config();

interface SupplierConfig {
  username: string;
  password: string;
  baseUrl: string;
  // Дополнительные настройки поставщика при необходимости
}

export const suppliers: Record<string, SupplierConfig> = {
  ug: {
    username: process.env.UG_USERNAME!,
    password: process.env.UG_PASSWORD!,
    baseUrl: `https://${process.env.UG_ABCP_ID}.public.api.abcp.ru`,
  },
  ug_f: {
    username: process.env.UG_USERNAME!,
    password: process.env.UG_PASSWORD!,
    baseUrl: `https://${process.env.UG_ABCP_ID}.public.api.abcp.ru`,
  },
  ug_bn: {
    username: process.env.UG_USERNAME_BN!,
    password: process.env.UG_PASSWORD_BN!,
    baseUrl: `https://${process.env.UG_ABCP_ID}.public.api.abcp.ru`,
  },
  turboCars: {
    username: process.env.TURBOCARS_USERNAME || '',
    password: process.env.TURBOCARS_PASSWORD || '',
    baseUrl: 'https://www.mikado-parts.ru',
  },
  turboCarsBN: {
    username: process.env.TURBOCARS_USERNAME_BN || '',
    password: process.env.TURBOCARS_PASSWORD_BN || '',
    baseUrl: 'https://www.mikado-parts.ru',
  },
  patriot: {
    username: process.env.PATRIOT_USERNAME!,
    password: process.env.PATRIOT_PASSWORD!,
    baseUrl: `https://${process.env.PATRIOT_ABCP_ID}.public.api.abcp.ru`,
  },
  npn: {
    username: process.env.NPN_USERNAME!,
    password: process.env.NPN_PASSWORD!,
    baseUrl: `https://${process.env.NPN_ABCP_ID}.public.api.abcp.ru`,
  },
};

export const PROXY_HOST = process.env.PROXY_HOST!;
export const PROXY_PORT = Number(process.env.PROXY_PORT);
export const PROXY_AUTH = process.env.PROXY_AUTH || '';

// export const TURBOCARS_SERVICE_PATH = '/ws1/service.asmx/Code_Search';
/**
 * Пути сервисов поставщика Turbo-cars
 */
export const TURBOCARS_SERVICE_PATHS = {
  /**
   * Возвращает данные включая аналоги
   */
  Code_search: '/ws1/service.asmx/Code_Search',
  Basket_Add: '/ws1/basket.asmx/Basket_Add',
};

export const ABCP_SERVICE_PATHS = {
  Brand_search: '/search/brands/',
  Article_search: '/search/articles/',
};

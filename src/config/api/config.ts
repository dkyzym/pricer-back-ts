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
    baseUrl: 'https://id9065.public.api.abcp.ru',
  },
  turboCars: {
    username: process.env.TURBOCARS_USERNAME || '',
    password: process.env.TURBOCARS_PASSWORD || '',
    baseUrl: 'https://www.mikado-parts.ru',
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

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
  // Добавьте других поставщиков здесь
  // SUPPLIER2: {
  //   username: process.env.SUPPLIER2_USERNAME!,
  //   password: process.env.SUPPLIER2_PASSWORD!,
  //   baseUrl: 'https://supplier2.api.endpoint',
  // },
};

export const PROXY_HOST = process.env.PROXY_HOST!;
export const PROXY_PORT = Number(process.env.PROXY_PORT);
export const PROXY_AUTH = process.env.PROXY_AUTH || '';

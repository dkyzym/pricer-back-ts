import dotenv from 'dotenv';
import { getEnvVar } from './getEnvVar.js';

dotenv.config();

/**
 * Интерфейс для конфигурации поставщика
 */
interface SupplierConfig {
  username: string;
  password: string;
  baseUrl: string;
  needAuth: boolean;
}

/**
 * Вспомогательная функция для создания конфигураций поставщиков типа ABCP.
 * Это помогает избежать дублирования кода.
 * @param abcpIdEnvVar - Имя переменной окружения для ABCP ID
 * @param userEnvVar - Имя переменной окружения для имени пользователя
 * @param passEnvVar - Имя переменной окружения для пароля
 * @returns Готовый объект конфигурации
 */
const createAbcpConfig = (
  abcpIdEnvVar: string,
  userEnvVar: string,
  passEnvVar: string,
): SupplierConfig => {
  const abcpId = getEnvVar(abcpIdEnvVar);
  return {
    username: getEnvVar(userEnvVar),
    password: getEnvVar(passEnvVar),
    baseUrl: `https://${abcpId}.public.api.abcp.ru`,
    needAuth: true
  };
};

/**
 * Экспортируемый объект с конфигурациями всех поставщиков.
 * Теперь используется хелпер getEnvVar, который выбросит ошибку при запуске,
 * если какая-то из обязательных переменных отсутствует.
 */
export const suppliers: Record<string, SupplierConfig> = {
  ug: createAbcpConfig('UG_ABCP_ID', 'UG_USERNAME', 'UG_PASSWORD'),
  ug_f: createAbcpConfig('UG_ABCP_ID', 'UG_USERNAME', 'UG_PASSWORD'),
  ug_bn: createAbcpConfig('UG_ABCP_ID', 'UG_USERNAME_BN', 'UG_PASSWORD_BN'),

  patriot: createAbcpConfig(
    'PATRIOT_ABCP_ID',
    'PATRIOT_USERNAME',
    'PATRIOT_PASSWORD'
  ),
  npn: createAbcpConfig('NPN_ABCP_ID', 'NPN_USERNAME', 'NPN_PASSWORD'),
  avtodinamika: createAbcpConfig(
    'AVTODINAMIKA_ABCP_ID',
    'AVTODINAMIKA_USERNAME',
    'AVTODINAMIKA_PASSWORD'
  ),
};

// --- Настройки прокси ---
export const PROXY_HOST = getEnvVar('PROXY_HOST');
const proxyPortStr = getEnvVar('PROXY_PORT');
export const PROXY_PORT = parseInt(proxyPortStr, 10);
export const PROXY_AUTH = process.env.PROXY_AUTH || ''; // Для PROXY_AUTH пустая строка может быть валидным значением

// Проверяем, что порт является корректным числом
if (isNaN(PROXY_PORT)) {
  throw new Error(
    `Переменная окружения "PROXY_PORT" должна быть числом. Получено: "${proxyPortStr}"`
  );
}

// --- Константы путей API ---

/**
 * Пути сервисов для поставщиков на платформе ABCP
 */
export const ABCP_SERVICE_PATHS = {
  Brand_search: '/search/brands/',
  Article_search: '/search/articles/',
};

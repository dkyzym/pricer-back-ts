import axios, { AxiosInstance } from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import * as cheerio from 'cheerio';
import * as qs from 'querystring';
import { CookieJar } from 'tough-cookie';
import { Logger } from 'winston';
import { ProfitGetOrdersResponse } from '../profit.types.js';

const BASE_URL = 'https://api.pr-lg.ru';
const SITE_URL = 'https://pr-lg.ru';

const ORGANIZATIONS = [
  {
    name: 'IP_Kizim_Cash', // Название для логов
    switchId: '14869822', // ID из ссылок переключения
  },
  {
    name: 'IP_Kizim_Bank',
    switchId: '495435',
  },
];

const DELAY_BETWEEN_REQUESTS = 2000; // Увеличил, чтобы сервер успевал "осознать" переключение
const MAX_RETRIES = 3;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Класс-клиент для инкапсуляции работы с сессией и куками
 */
class ProfitSessionClient {
  private client: AxiosInstance;
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
    const jar = new CookieJar();

    this.client = wrapper(
      axios.create({
        jar,
        // httpsAgent,
        withCredentials: true,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        timeout: 15000,
      })
    );
  }

  /**
   * Авторизация с парсингом CSRF
   */
  async login(): Promise<void> {
    const email = process.env.PROFIT_LOGIN;
    const password = process.env.PROFIT_PASSWORD;

    if (!email || !password) {
      throw new Error('PROFIT_LOGIN or PROFIT_PASSWORD is missing in env');
    }

    try {
      this.logger.debug('[profit] Starting login sequence...');

      // 1. Получаем страницу логина и CSRF токен
      const loginPage = await this.client.get(`${SITE_URL}/login`);
      const $ = cheerio.load(loginPage.data);
      const csrfToken = $('meta[name="csrf-token"]').attr('content');

      // 2. Отправляем форму
      const formData = {
        _csrf: csrfToken || '',
        'UserForm[email]': email,
        'UserForm[password]': password,
        'UserForm[rememberMe]': '1',
      };

      const response = await this.client.post(
        `${SITE_URL}/login`,
        qs.stringify(formData),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Referer: `${SITE_URL}/login`,
          },
          maxRedirects: 5,
        }
      );

      // 3. Проверяем успех
      if (!response.data.includes('Оптовый клиент')) {
        // Иногда редирект не срабатывает как надо, проверяем куки или URL
        // Но наличие текста надежнее
        throw new Error('Login failed: marker "Оптовый клиент" not found');
      }

      this.logger.info('[profit] Login successful');
    } catch (error) {
      this.logger.error('[profit] Login failed', {
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }
  }

  /**
   * Переключение активной организации
   */
  async switchContext(orgId: string): Promise<void> {
    try {
      await this.client.get(`${SITE_URL}/account/legals/select/id/${orgId}`, {
        maxRedirects: 5,
      });
    } catch (error) {
      throw new Error(
        `Failed to switch context to ${orgId}: ${error instanceof Error ? error.message : 'Unknown'}`
      );
    }
  }

  /**
   * Запрос к API (обертка для использования внутри fetchWithRetry)
   */
  async getOrders(params: any): Promise<ProfitGetOrdersResponse> {
    const response = await this.client.get<ProfitGetOrdersResponse>(
      `${BASE_URL}/orders/list`,
      { params }
    );
    return response.data;
  }
}

/**
 * ОСНОВНАЯ ФУНКЦИЯ
 */
export const fetchProfitOrders = async (
  logger: Logger
): Promise<ProfitGetOrdersResponse> => {
  const secret = process.env.PROFIT_API_KEY;
  if (!secret) throw new Error('PROFIT_API_KEY is missing');

  // Инициализируем сессионного клиента
  const sessionClient = new ProfitSessionClient(logger);

  // 1. Сначала логинимся (один раз на весь цикл)
  await sessionClient.login();

  const combinedData: ProfitGetOrdersResponse = {
    pages: 0,
    currentPage: 1,
    pageSize: 0,
    data: [],
  };

  let successCount = 0;
  let failedCount = 0;

  // Итерируемся по ОРГАНИЗАЦИЯМ, а не по типам оплаты
  for (let i = 0; i < ORGANIZATIONS.length; i++) {
    const org = ORGANIZATIONS[i];

    logger.info(
      `[profit] Processing org ${org.name} (${i + 1}/${ORGANIZATIONS.length})`
    );

    try {
      // 2. Переключаем контекст
      await sessionClient.switchContext(org.switchId);

      // Даем серверу немного времени на применение контекста
      await delay(1000);

      // 3. Выполняем запрос к API (с ретраями)
      const baseParams = { secret, action: 'list', page: 1 };

      // Локальная функция ретрая, привязанная к текущей сессии
      const fetchWithRetryLocal = async (
        retry = 0
      ): Promise<ProfitGetOrdersResponse | null> => {
        try {
          return await sessionClient.getOrders(baseParams);
        } catch (error) {
          if (
            axios.isAxiosError(error) &&
            error.response?.status === 429 &&
            retry < MAX_RETRIES
          ) {
            const waitTime = Math.pow(2, retry) * 2000;
            logger.warn(`[profit] Rate limit, retry in ${waitTime}ms`);
            await delay(waitTime);
            return fetchWithRetryLocal(retry + 1);
          }
          throw error;
        }
      };

      const result = await fetchWithRetryLocal();

      if (result && result.data && Array.isArray(result.data)) {
        combinedData.data.push(...result.data);
        successCount++;

        logger.info(
          `[profit] Org ${org.name} success: ${result.data.length} orders`
        );

        if (result.pages > combinedData.pages) {
          combinedData.pages = result.pages;
        }
      }
    } catch (error) {
      failedCount++;
      logger.warn(`[profit] Failed to fetch for ${org.name}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Задержка между организациями
    if (i < ORGANIZATIONS.length - 1) {
      await delay(DELAY_BETWEEN_REQUESTS);
    }
  }

  if (successCount === 0) {
    throw new Error(
      `All Profit orgs failed (${failedCount}/${ORGANIZATIONS.length})`
    );
  }

  // Удаляем дубликаты
  const uniqueOrders = new Map();
  for (const order of combinedData.data) {
    uniqueOrders.set(order.order_id, order);
  }
  combinedData.data = Array.from(uniqueOrders.values());

  logger.info('[profit] Orders fetched successfully', {
    totalOrders: combinedData.data.length,
    successfulSources: successCount,
  });

  return combinedData;
};

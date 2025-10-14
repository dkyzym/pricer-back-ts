import axios from 'axios';
import chalk from 'chalk';
import * as cheerio from 'cheerio';
import 'dotenv/config';
import { logger } from '../../config/logger/index.js';
import { clientAvtoPartner } from './client.js';

const baseURL = 'https://avtopartner-yug.ru';
const userAgent =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0';
const supplier = 'AvtoPartner';

/**
 * Проверяет, залогинен ли пользователь, по наличию элемента "Аккаунт" на главной странице.
 * @returns {Promise<boolean>} - true, если пользователь залогинен, иначе false.
 */
const checkIsLoggedIn = async (): Promise<boolean> => {
  try {
    const response = await clientAvtoPartner.get(baseURL, {
      headers: { 'User-Agent': userAgent },
    });
    const $ = cheerio.load(response.data);
    const accountLink = $('a.header-middle__link--login:contains("Аккаунт")');
    return accountLink.length > 0;
  } catch (error) {
    logger.error(`[${supplier}] Ошибка при проверке статуса входа:`, error);
    return false;
  }
};

/**
 * Выполняет непосредственный вход на сайт.
 * @returns {Promise<boolean>} - true в случае успеха, иначе false.
 */
export const loginAvtoPartner = async (): Promise<boolean> => {
  const login = process.env.AVTOPARTNER_LOGIN;
  const password = process.env.AVTOPARTNER_PASSWORD;

  if (!login || !password) {
    logger.error(
      chalk.red(
        `[${supplier}] Ошибка: AVTOPARTNER_LOGIN или AVTOPARTNER_PASSWORD не найдены в .env файле.`
      )
    );
    return false;
  }

  try {
    logger.info(
      `[${supplier}] 1/3: Загрузка страницы входа для получения form_build_id...`
    );
    const loginPageResponse = await clientAvtoPartner.get(
      `${baseURL}/user/login`,
      {
        headers: { 'User-Agent': userAgent },
      }
    );

    const $ = cheerio.load(loginPageResponse.data);
    const formBuildId = $('input[name="form_build_id"]').val();

    if (!formBuildId || typeof formBuildId !== 'string') {
      logger.error(
        chalk.red(
          `[${supplier}] Не удалось найти form_build_id. Структура сайта могла измениться.`
        )
      );
      return false;
    }
    logger.info(
      chalk.gray(` > [${supplier}] Найден form_build_id: ${formBuildId}`)
    );

    const formData = new URLSearchParams();
    formData.append('name', login);
    formData.append('pass', password);
    formData.append('form_build_id', formBuildId);
    formData.append('form_id', 'user_login');
    formData.append('op', 'Войти');

    logger.info(`[${supplier}] 2/3: Отправка учетных данных...`);
    await clientAvtoPartner.post(`${baseURL}/user/login`, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': userAgent,
        Referer: `${baseURL}/user/login`,
      },
    });

    logger.info(`[${supplier}] 3/3: Проверка успешности входа...`);
    const isLoggedIn = await checkIsLoggedIn();
    if (isLoggedIn) {
      logger.info(chalk.green(`✅ [${supplier}] Вход выполнен успешно!`));
    } else {
      logger.error(
        chalk.red(
          `❌ [${supplier}] Не удалось войти. Проверьте учетные данные.`
        )
      );
    }
    return isLoggedIn;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error(
        chalk.red(`[${supplier}] Ошибка сети при входе: ${error.message}`)
      );
    } else {
      logger.error(
        chalk.red(`[${supplier}] Непредвиденная ошибка при входе:`),
        error
      );
    }
    return false;
  }
};

// --- Механизм управления параллельными запросами на вход ---
let isLoggingIn = false;
const loginQueue: ((success: boolean) => void)[] = [];

/**
 * Гарантирует, что сессия с Автопартнером активна.
 * Если сессии нет, выполняет вход и обрабатывает очередь ожидающих запросов.
 */
export const ensureAvtoPartnerLoggedIn = async () => {
  const isLoggedIn = await checkIsLoggedIn();

  if (!isLoggedIn) {
    if (isLoggingIn) {
      logger.info(
        chalk.yellow(
          `[${supplier}] Процесс входа уже запущен, ожидаем в очереди...`
        )
      );
      await new Promise<boolean>((resolve) => loginQueue.push(resolve));
    } else {
      isLoggingIn = true;
      try {
        logger.info(
          chalk.yellow(
            `[${supplier}] Сессия отсутствует или истекла, выполняем вход...`
          )
        );
        const success = await loginAvtoPartner();
        loginQueue.forEach((resolve) => resolve(success));
      } finally {
        isLoggingIn = false;
        loginQueue.length = 0;
      }
    }
  } else {
    logger.info(chalk.blue(`[${supplier}] Сессия активна.`));
  }
};

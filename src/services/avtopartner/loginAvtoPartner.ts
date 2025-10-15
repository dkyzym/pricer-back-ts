import chalk from 'chalk';
import * as cheerio from 'cheerio';
import 'dotenv/config';
import { logger } from '../../config/logger/index.js';
import { clientAvtoPartner, cookieJarAvtoPartner } from './client.js';

const baseURL = 'https://avtopartner-yug.ru';
const supplier = 'avtoPartner';
const userAgent =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0';

/**
 * Проверяет, активна ли текущая сессия avtopartner-yug.ru.
 * Критерий: есть куки и на главной странице есть ссылка «Аккаунт».
 */
const checkIsLoggedIn = async (): Promise<boolean> => {
  const cookies = await cookieJarAvtoPartner.getCookies(baseURL);
  if (cookies.length === 0) {
    logger.debug(`[${supplier}] checkIsLoggedIn: куки пустые → не залогинен`);
    return false;
  }

  try {
    const response = await clientAvtoPartner.get(baseURL);
    const $ = cheerio.load(response.data);
    const hasAccountLink = $('a.header-middle__link--login:contains("Аккаунт")').length > 0;
    logger.debug(`[${supplier}] checkIsLoggedIn: найден Аккаунт = ${hasAccountLink}`);
    return hasAccountLink;
  } catch {
    return false;
  }
};

/**
 * Выполняет вход на сайт с использованием .env-переменных.
 * Возвращает true, если вход выполнен успешно.
 */
export const loginAvtoPartner = async (): Promise<boolean> => {
  const login = process.env.AVTOPARTNER_LOGIN;
  const password = process.env.AVTOPARTNER_PASSWORD;

  if (!login || !password) {
    logger.error(
      chalk.red(
        `[${supplier}] ❌ Логин/пароль не заданы в .env (AVTOPARTNER_LOGIN / AVTOPARTNER_PASSWORD)`
      )
    );
    return false;
  }

  try {
    logger.info(`[${supplier}] 1/3: Получение страницы входа...`);
    const loginPageResponse = await clientAvtoPartner.get('/user/login');
    const $ = cheerio.load(loginPageResponse.data);
    const formBuildId = $('input[name="form_build_id"]').val();

    if (!formBuildId || typeof formBuildId !== 'string') {
      logger.error(chalk.red(`[${supplier}] Не найден form_build_id — возможно, сайт изменился.`));
      return false;
    }

    const formData = new URLSearchParams();
    formData.append('name', login);
    formData.append('pass', password);
    formData.append('form_build_id', formBuildId);
    formData.append('form_id', 'user_login');
    formData.append('op', 'Войти');

    logger.info(`[${supplier}] 2/3: Отправка данных входа...`);
    await clientAvtoPartner.post(`${baseURL}/user/login`, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': userAgent,
        Referer: `${baseURL}/user/login`,
      },
      maxRedirects: 5,
    });

    logger.info(`[${supplier}] 3/3: Проверка входа...`);
    const isLoggedIn = await checkIsLoggedIn();
    if (isLoggedIn) {
      logger.info(chalk.green(`✅ [${supplier}] Вход выполнен успешно!`));
    } else {
      logger.error(chalk.red(`❌ [${supplier}] Вход не удался.`));
    }

    return isLoggedIn;
  } catch (error) {
    logger.error(chalk.red(`[${supplier}] Ошибка при логине:`), error);
    return false;
  }
};

// --- Синхронизация логина между конкурентными вызовами ---
let isLoggingIn = false;
const loginQueue: ((success: boolean) => void)[] = [];

/**
 * Гарантирует, что перед запросом клиент авторизован.
 * Если кто-то уже логинится — ждёт завершения.
 */
export const ensureAvtoPartnerLoggedIn = async () => {
  const isLoggedIn = await checkIsLoggedIn();

  if (!isLoggedIn) {
    if (isLoggingIn) {
      logger.info(chalk.yellow(`[${supplier}] Логин уже выполняется — ожидаем...`));
      await new Promise<boolean>((resolve) => loginQueue.push(resolve));
    } else {
      isLoggingIn = true;
      try {
        logger.warn(chalk.yellow(`[${supplier}] Сессия неактивна — выполняем вход...`));
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

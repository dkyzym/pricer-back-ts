import * as cheerio from 'cheerio';
import { AnyNode } from 'domhandler';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../config/logger/index.js';

import { calculateDeliveryDate } from '../../utils/calculateDates/calculateDeliveryDate.js';
import { isRelevantBrand } from '../../utils/data/brand/isRelevantBrand.js';
import { clientAvtoPartner } from './client.js';
import { ensureAvtoPartnerLoggedIn } from './loginAvtoPartner.js';
import { ParallelSearchParams, SearchResultsParsed } from '../../types/search.types.js';

const baseURL = 'https://avtopartner-yug.ru';
const userAgent =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0';

// Константы для присвоения товару
const AVTOPARTNER_CONSTANTS = {
  WAREHOUSE: 'Свой',
  PROBABILITY: 95,
  DEADLINE: 4,
  DEADLINE_MAX: 4,
} as const;

/**
 * 🧩 Убирает пробелы, дефисы и переводит в lowercase для унификации артикулов
 */
const normalizeForComparison = (str: string): string =>
  str.toLowerCase().replace(/[\s-]/g, '');

/**
 * 🧩 Парсит карточку товара на странице поиска.
 * Возвращает null, если карточка неполная, нет в наличии, или без цены.
 */
const parseProductCard = (
  $: cheerio.CheerioAPI,
  el: AnyNode
): Omit<
  SearchResultsParsed,
  'id' | 'supplier' | 'probability' | 'deadline' | 'deadLineMax'
> | null => {
  const card = $(el);

  const article = card.find('.product-card__sku').text().replace('Арт.:', '').trim();
  const brand = card.find('.product-card__brand [itemprop="name"]').text().trim();
  const description = card.find('.product-card__title').text().trim();

  // 🧩 Удаляем вложенные теги (рубли, span и т.п.)
  const priceText = card.find('.product-card__price--list .price__current')
    .clone()
    .children()
    .remove()
    .end()
    .text()
    .replace(',', '.')
    .replace(/\s+/g, '')
    .trim();

  const price = parseFloat(priceText.replace(/[^0-9.]/g, '')) || 0;

  // Проверяем, есть ли товар в наличии
  const isOutOfStock = card.find('.product-post__status.out-of-stock').length > 0;

  // ❗ НОВОЕ ИЗМЕНЕНИЕ: Если товара нет, сразу возвращаем null
  if (isOutOfStock) {
    // logger.debug(`[avtoPartner] Пропущена карточка (нет в наличии): ${brand} ${article}`);
    return null;
  }

  // Если товар есть, количество всегда будет '+'
  const availability = '+';

  const imageUrlRaw = card.find('.product-card__picture img').attr('src') || '';
  const imageUrl = imageUrlRaw.startsWith('http') ? imageUrlRaw : `${baseURL}${imageUrlRaw}`;

  // Старая проверка на неполные данные остается
  if (!article || !brand || price <= 0) {
    logger.debug(`[avtoPartner] Пропущена карточка — неполные данные (${brand} ${article})`);
    return null;
  }

  return {
    article,
    brand,
    description,
    availability,
    price,
    imageUrl,
    warehouse: AVTOPARTNER_CONSTANTS.WAREHOUSE,
  };
};

/**
 * 🔎 Основная функция поиска товара на avtopartner-yug.ru
 */
export const itemDataAvtoPartnerService = async ({
  item,
  supplier,
  userLogger,
}: ParallelSearchParams): Promise<SearchResultsParsed[]> => {
  // 1️⃣ Гарантируем активную авторизацию
  await ensureAvtoPartnerLoggedIn();

  const searchUrl = `${baseURL}/search/${encodeURIComponent(item.article)}`;
  userLogger.info(`[${supplier}] Выполняем запрос на поиск: ${searchUrl}`);

  try {
    // 2️⃣ Выполняем HTTP-запрос
    const response = await clientAvtoPartner.get(searchUrl, {
      headers: { 'User-Agent': userAgent },
      maxRedirects: 5,
    });

    const $ = cheerio.load(response.data);

    // 3️⃣ Проверяем: это страница с одной карточкой?
    const productCards = $('article.product-card');
    const isSingleProductPage =
      productCards.length === 0 && $('.product-detail__content').length > 0;

    if (isSingleProductPage) {
      userLogger.info(`[${supplier}] Редирект на страницу одного товара (пропускаем)`);
      return [];
    }

    userLogger.info(`[${supplier}] Найдено ${productCards.length} карточек`);

    const normalizedSearchArticle = normalizeForComparison(item.article);
    const results: SearchResultsParsed[] = [];

    // 4️⃣ Парсим карточки и фильтруем по бренду/артикулу
    productCards.each((_, element) => {
      const parsed = parseProductCard($, element);
      if (!parsed) return;

      const brandMatch = isRelevantBrand(item.brand, parsed.brand);
      const articleMatch =
        normalizeForComparison(parsed.article) === normalizedSearchArticle;
      const needToCheckBrand = isRelevantBrand(item.brand, parsed.brand);

      if (brandMatch && articleMatch) {
        results.push({
          ...parsed,
          id: uuidv4(),
          supplier,
          probability: AVTOPARTNER_CONSTANTS.PROBABILITY,
          deadline: AVTOPARTNER_CONSTANTS.DEADLINE,
          deadLineMax: AVTOPARTNER_CONSTANTS.DEADLINE_MAX,
          needToCheckBrand,
        });

        userLogger.info(
          `[${supplier}] ✅ Совпадение: ${parsed.brand} ${parsed.article} — ${parsed.price} ₽`
        );
      }
    });

    // 5️⃣ Проверка результатов
    if (results.length === 0) {
      userLogger.warn(`[${supplier}] Товар ${item.brand} ${item.article} не найден`);
    }

    // 6️⃣ Подсчёт даты доставки
    return results.map((result) => ({
      ...result,
      deliveryDate: calculateDeliveryDate(result, userLogger),
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[${supplier}] Ошибка при поиске товара: ${message}`);
    userLogger.error(`[${supplier}] Ошибка при поиске товара`);
    return [];
  }
};


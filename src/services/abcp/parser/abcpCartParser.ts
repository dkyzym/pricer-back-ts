import * as cheerio from 'cheerio';
import fs from 'fs';
import { cleanArticleString } from '../../../utils/data/brand/cleanArticleString';
import { standardizeString } from '../../../utils/data/brand/standardizeString';

/** Данные, извлечённые из скрытого input-элемента для добавления товара в корзину */
export interface AddToCartData {
  searchResultUniqueId: string;
  distributorRouteId: string;
  dataSetKey: string;
  weight: string;
  /** Оригинальное значение атрибута number из DOM */
  parsedNumber: string;
  /** Оригинальное значение атрибута numberfix из DOM */
  parsedNumberFix: string;
  /** Оригинальное значение атрибута brand из DOM */
  parsedBrand: string;
}

/**
 * Парсит HTML страницы результатов поиска ABCP и извлекает параметры,
 * необходимые для добавления конкретного товара в корзину.
 *
 * Поток данных:
 *   HTML-страница → cheerio → фильтрация `input.addToBasketLinkFake`
 *   по number/numberfix (case-insensitive) и brand (case-insensitive)
 *   → исключение элементов с availability="0" (API отклоняет их добавление)
 *   → маппинг kebab-атрибутов в camelCase-объект AddToCartData.
 *
 * @param html             - Сырой HTML страницы результатов поиска
 * @param targetNumber     - Артикул товара для поиска (сравнение без учёта регистра)
 * @param targetBrand      - Бренд товара для поиска (сравнение без учёта регистра)
 * @param targetRouteId    - Опциональный ID маршрута поставщика для приоритетного выбора предложения
 * @throws {Error} Если элемент не найден, все предложения недоступны (availability=0) или отсутствует критический атрибут `datasetkey`
 */
export const parseAddToCartData = (
  html: string,
  targetNumber: string,
  targetBrand: string,
  targetRouteId?: string
): AddToCartData => {
  const $ = cheerio.load(html);

  const safeTargetNumber = cleanArticleString(targetNumber);
  const safeTargetBrand = standardizeString(targetBrand);

  const allMatches = $('input.addToBasketLinkFake').filter((_i, el) => {
    const rawNumber = $(el).attr('number') ?? '';
    const rawNumberFix = $(el).attr('numberfix') ?? '';
    const rawBrand = $(el).attr('brand') ?? '';

    const elNumber = cleanArticleString(rawNumber);
    const elNumberFix = cleanArticleString(rawNumberFix);
    const elBrand = standardizeString(rawBrand);

    const isNumberMatch = safeTargetNumber === elNumber || safeTargetNumber === elNumberFix;
    const isBrandMatch = safeTargetBrand === elBrand;

    return isNumberMatch && isBrandMatch;
  });

  const availableMatches = allMatches.filter((_i, el) => {
    const availability = $(el).attr('availability');
    return availability !== '0';
  });

  // Приоритет: точное совпадение по маршруту поставщика; при отсутствии — первое доступное предложение
  let targetEl = availableMatches.filter((_i, el) => $(el).attr('distributorrouteid') === targetRouteId).first();
  if (!targetEl.length) {
    targetEl = availableMatches.first();
  }

  if (allMatches.length > 0 && availableMatches.length === 0) {
    fs.writeFileSync('debug_mikano_error.html', html);
    throw new Error('Все предложения для данного товара недоступны для заказа (availability=0)');
  }
  if (!targetEl.length) {
    fs.writeFileSync('debug_mikano_error.html', html);
    throw new Error('Данные для добавления в корзину не найдены на странице');
  }

  // datasetkey — критический атрибут: без него невозможно сформировать запрос корзины
  const rawDataSetKey = targetEl.attr('datasetkey');
  if (!rawDataSetKey) {
    fs.writeFileSync('debug_mikano_error.html', html);
    throw new Error('Данные для добавления в корзину не найдены на странице');
  }

  return {
    searchResultUniqueId: targetEl.attr('searchresultuniqueid') ?? '',
    distributorRouteId: targetEl.attr('distributorrouteid') ?? '',
    // ABCP отдаёт datasetkey уже URL-закодированным (%2F, %2B и т.д.),
    // поэтому декодируем здесь, чтобы URLSearchParams не закодировал его повторно
    dataSetKey: decodeURIComponent(rawDataSetKey),
    weight: targetEl.attr('weight') ?? '',
    parsedNumber: targetEl.attr('number') ?? '',
    parsedNumberFix: targetEl.attr('numberfix') ?? '',
    parsedBrand: targetEl.attr('brand') ?? '',
  };
};

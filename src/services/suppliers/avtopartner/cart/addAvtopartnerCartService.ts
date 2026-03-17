import * as cheerio from 'cheerio';
import { AnyNode } from 'domhandler';
import { logger } from '../../../../config/logger/index.js';
import { cleanArticleString } from '../../../../utils/data/brand/cleanArticleString.js';
import { isRelevantBrand } from '../../../../utils/data/brand/isRelevantBrand.js';
import { yieldToEventLoop } from '../../../../utils/yieldToEventLoop.js';
import type {
  ABCP_API_CartResponse,
  BasketPositionUG,
} from '../../../orchestration/cart/cart.types.js';
import { clientAvtoPartner } from '../client.js';
import { ensureAvtoPartnerLoggedIn } from '../loginAvtoPartner.js';

const supplier = 'avtoPartner';

const normalizeForComparison = (str: string): string =>
  str.toLowerCase().replace(/[\s-]/g, '');

/**
 * Последовательно добавляет позиции в корзину Drupal Commerce (avtopartner-yug.ru).
 *
 * Поток:
 *  positions[] → for-of (sequential)
 *  → ensureAvtoPartnerLoggedIn
 *  → GET /search/{number}         (HTML со списком карточек)
 *  → cheerio: поиск карточки по бренду + артикулу
 *  → извлечение скрытых Drupal-токенов формы
 *  → POST /system/ajax            (x-www-form-urlencoded)
 *  → ABCP_API_CartResponse
 */
export const addAvtopartnerCart = async (
  positions: BasketPositionUG[],
  supplierName: string
): Promise<ABCP_API_CartResponse> => {
  await ensureAvtoPartnerLoggedIn();

  const resultPositions: ABCP_API_CartResponse['positions'] = [];

  for (const position of positions) {
    try {
      const searchUrl = `/search/${encodeURIComponent(position.number)}`;

      const response = await clientAvtoPartner.get(searchUrl);

      await yieldToEventLoop();

      const $ = cheerio.load(response.data);

      const normalizedTarget = normalizeForComparison(position.number);
      const cleanTarget = cleanArticleString(position.number);

      const productCards = $('article.product-card');
      let form: cheerio.Cheerio<AnyNode> | null = null;

      if (productCards.length > 0) {
        let matchedCard: cheerio.Cheerio<AnyNode> | null = null;
        productCards.each((_, el) => {
          if (matchedCard) return;
          const card = $(el);
          const article = card.find('.product-card__sku').text().replace('Арт.:', '').trim();
          const brand = card.find('.product-card__brand [itemprop="name"]').text().trim();

          const brandMatch = isRelevantBrand(position.brand, brand);
          const articleMatch =
            normalizeForComparison(article) === normalizedTarget ||
            cleanArticleString(article) === cleanTarget;

          if (brandMatch && articleMatch) {
            matchedCard = card;
          }
        });

        if (!matchedCard) {
          throw new Error('Товар не найден в списке результатов поиска');
        }
        form = (matchedCard as cheerio.Cheerio<AnyNode>).find('form[id^="commerce-cart-add-to-cart-form-"]');
      } else if ($('.product-detail__content').length > 0) {
        // Редирект на страницу одного товара — форма лежит вне карточки
        form = $('form[id^="commerce-cart-add-to-cart-form-"]');
      }

      if (!form || form.length === 0) {
        throw new Error('Форма добавления в корзину не найдена на странице');
      }

      const productId = form.find('input[name="product_id"]').val() as string | undefined;
      const formBuildId = form.find('input[name="form_build_id"]').val() as string | undefined;
      const formToken = form.find('input[name="form_token"]').val() as string | undefined;
      const formId = form.find('input[name="form_id"]').val() as string | undefined;

      if (!productId || !formBuildId || !formToken || !formId) {
        throw new Error('Не найдены токены формы Drupal');
      }

      const payload = new URLSearchParams({
        product_id: productId,
        form_build_id: formBuildId,
        form_token: formToken,
        form_id: formId,
        quantity: position.quantity.toString(),
      });

      const postResponse = await clientAvtoPartner.post('/system/ajax', payload.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          Referer: searchUrl,
        },
      });
      const responseStr = JSON.stringify(postResponse.data);

      if (!responseStr.includes('added-product-message') && !responseStr.includes('add-cart-message-wrapper')) {
        throw new Error('Сервер не подтвердил добавление товара (возможно, изменились остатки)');
      }

      resultPositions.push({
        number: position.number,
        brand: position.brand,
        supplierCode: position.supplierCode,
        quantity: position.quantity.toString(),
        numberFix: position.number,
        deadline: 0,
        deadlineMax: 0,
        description: '',
        status: 1,
      });

      logger.info(
        `[${supplier}] ✅ Добавлено в корзину: ${position.brand} / ${position.number} x${position.quantity}`
      );
    } catch (error: any) {
      logger.error(
        `[${supplier}] Ошибка добавления в корзину: ` +
          `${position.brand} / ${position.number} — ${error.message}`
      );

      resultPositions.push({
        number: position.number,
        brand: position.brand,
        supplierCode: position.supplierCode,
        quantity: position.quantity.toString(),
        numberFix: position.number,
        deadline: 0,
        deadlineMax: 0,
        description: '',
        status: 0,
        errorMessage: error.message ?? 'Неизвестная ошибка',
      });
    }
  }

  const hasSuccess = resultPositions.some((p) => p.status === 1);

  return {
    status: hasSuccess ? 1 : 0,
    positions: resultPositions,
  };
};

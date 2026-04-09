import * as cheerio from 'cheerio';
import { Logger } from 'winston';
import { ICartItemDocument } from '../../../models/CartItem.js';
import type {
  CheckoutHandler,
  CheckoutResult,
  UnifiedCartPosition,
} from '../../orchestration/cart/cart.types.js';
import { clientAvtoPartner } from './client.js';
import { ensureAvtoPartnerLoggedIn } from './loginAvtoPartner.js';
import { addAvtopartnerCart } from './cart/addAvtopartnerCartService.js';

const SUPPLIER_KEY = 'avtoPartner';
const CHECKOUT_FORM_ID = 'commerce_checkout_form_checkout';

/** Задержка между HTTP-запросами к Drupal (rate-limit, защита от блокировки). */
const STEP_DELAY_MS = 700;

/** Задержка между DELETE-запросами при очистке корзины. */
const REMOVE_DELAY_MS = 400;

/** Лимит символов для дампа HTML в логах. */
const HTML_DUMP_LIMIT = 1500;

const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ─────────────────────────────────────────────────────────────────────────────
//  Типы
// ─────────────────────────────────────────────────────────────────────────────

interface DrupalFormTokens {
  formBuildId: string;
  formToken: string;
  formId: string;
}

/** Позиция, распарсенная из HTML страницы /cart. */
interface CartLineItem {
  lineId: string;
  article: string;
  quantity: number;
}

/** Результат парсинга страницы /cart. */
interface ParsedCart {
  orderId: string | null;
  items: CartLineItem[];
}

// ─────────────────────────────────────────────────────────────────────────────
//  Утилиты сборки и парсинга
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Для addAvtopartnerCart критичны number (артикул для поиска) и brand (для матчинга).
 * supplierCode / itemKey — не используются скрапером avtopartner, но обязательны по контракту.
 */
const cartItemToPosition = (item: ICartItemDocument): UnifiedCartPosition => ({
  number: item.article,
  brand: item.brand,
  supplierCode: '',
  itemKey: '',
  quantity: item.quantity,
});

const normalizeArticle = (raw: string): string =>
  raw.replace(/^Артикул:\s*/i, '').trim();

/**
 * Парсит страницу /cart: orderId из data-orderid, позиции из li[data-lineid].
 * orderId может отсутствовать, если корзина пуста.
 */
const parseCartPage = (html: string): ParsedCart => {
  const $ = cheerio.load(html);

  const orderId =
    $('.cart-content__inner').attr('data-orderid') ?? null;

  const items: CartLineItem[] = [];
  $('li[data-lineid]').each((_, el) => {
    const $li = $(el);
    const lineId = $li.attr('data-lineid') ?? '';
    const article = normalizeArticle($li.find('.cart-product__sku').text());
    const quantity = parseInt($li.find('.quantity__value').text().trim(), 10) || 0;
    if (lineId) {
      items.push({ lineId, article, quantity });
    }
  });

  return { orderId, items };
};

/**
 * Удаляет одну позицию из корзины Drupal Commerce.
 * Endpoint: POST /remove-line-item/{orderId}/{lineId} (AJAX, JSON-ответ).
 */
const removeLineItem = async (
  orderId: string,
  lineId: string,
): Promise<void> => {
  await clientAvtoPartner.post(
    `/remove-line-item/${orderId}/${lineId}`,
    '',
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        Accept: 'application/json, text/javascript, */*; q=0.01',
        Referer: 'https://avtopartner-yug.ru/cart',
      },
    },
  );
};

/**
 * Полная очистка корзины: GET /cart → парсинг → POST remove для каждой позиции.
 * Возвращает количество удалённых позиций.
 */
const clearCart = async (userLogger: Logger): Promise<number> => {
  const res = await clientAvtoPartner.get('/cart');
  const cart = parseCartPage(res.data as string);

  if (cart.items.length === 0) {
    userLogger.info(`[${SUPPLIER_KEY}] Корзина уже пуста`);
    return 0;
  }

  if (!cart.orderId) {
    userLogger.warn(`[${SUPPLIER_KEY}] В корзине ${cart.items.length} позиций, но orderId не найден`);
    return 0;
  }

  userLogger.info(`[${SUPPLIER_KEY}] Очистка корзины: ${cart.items.length} позиций, orderId=${cart.orderId}`);

  for (const item of cart.items) {
    try {
      await removeLineItem(cart.orderId, item.lineId);
      userLogger.info(`[${SUPPLIER_KEY}] Удалена позиция lineId=${item.lineId} (${item.article} x${item.quantity})`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      userLogger.error(`[${SUPPLIER_KEY}] Ошибка удаления lineId=${item.lineId}: ${msg}`);
      throw new Error(`Не удалось очистить корзину: ошибка удаления позиции ${item.article}`);
    }
    await pause(REMOVE_DELAY_MS);
  }

  return cart.items.length;
};

/**
 * Сравнивает фактическое содержимое корзины с ожидаемым набором позиций.
 * Возвращает null при совпадении, или строку с описанием расхождений.
 */
const validateCartContents = (
  actual: CartLineItem[],
  expected: UnifiedCartPosition[],
): string | null => {
  const mismatches: string[] = [];

  for (const exp of expected) {
    const match = actual.find(
      (a) => a.article === exp.number,
    );
    if (!match) {
      mismatches.push(`${exp.number}: не найден в корзине`);
    } else if (match.quantity !== exp.quantity) {
      mismatches.push(
        `${exp.number}: ожидалось qty=${exp.quantity}, в корзине qty=${match.quantity}`,
      );
    }
  }

  const expectedArticles = new Set(expected.map((e) => e.number));
  for (const item of actual) {
    if (!expectedArticles.has(item.article)) {
      mismatches.push(`${item.article} x${item.quantity}: лишняя позиция в корзине`);
    }
  }

  return mismatches.length > 0 ? mismatches.join('; ') : null;
};

/**
 * Парсит CSRF-токены именно checkout-формы (commerce_checkout_form_checkout).
 *
 * На странице Drupal присутствует несколько <form> (поиск, checkout и пр.),
 * поэтому нельзя брать первый попавшийся input[name="form_build_id"] —
 * нужно найти <form>, содержащую input[name="form_id"][value="commerce_checkout_form_checkout"],
 * и достать токены из неё.
 */
const parseDrupalFormTokens = (
  html: string,
  userLogger: Logger,
): DrupalFormTokens | null => {
  const $ = cheerio.load(html);

  const allFormIds = $('input[name="form_id"]')
    .map((_, el) => $(el).val())
    .get();
  userLogger.info(`[${SUPPLIER_KEY}] Найденные form_id на странице`, {
    formIds: allFormIds,
  });

  const checkoutFormIdInput = $(`input[name="form_id"][value="${CHECKOUT_FORM_ID}"]`);
  if (checkoutFormIdInput.length === 0) {
    userLogger.error(`[${SUPPLIER_KEY}] input[form_id="${CHECKOUT_FORM_ID}"] не найден на странице`, {
      availableFormIds: allFormIds,
      htmlSnippet: html.slice(0, HTML_DUMP_LIMIT),
    });
    return null;
  }

  const $form = checkoutFormIdInput.closest('form');
  if ($form.length === 0) {
    userLogger.error(`[${SUPPLIER_KEY}] Родительский <form> для checkout input не найден`);
    return null;
  }

  const formBuildId = $form.find('input[name="form_build_id"]').val() as string | undefined;
  const formToken = $form.find('input[name="form_token"]').val() as string | undefined;

  if (!formBuildId || !formToken) {
    userLogger.error(`[${SUPPLIER_KEY}] form_build_id или form_token отсутствуют в checkout-форме`, {
      hasFormBuildId: !!formBuildId,
      hasFormToken: !!formToken,
    });
    return null;
  }

  return { formBuildId, formToken, formId: CHECKOUT_FORM_ID };
};

/** Проверяет, является ли HTML страницей благодарности Drupal Commerce. */
const isThankYouPage = (html: string): boolean => {
  const $ = cheerio.load(html);
  return (
    $('.thanks__title').text().includes('Спасибо') ||
    html.includes('Спасибо за заказ')
  );
};

/** Извлекает «№ 133172» → «133172» из HTML страницы завершения. */
const extractConfirmedOrderId = (html: string): string | null => {
  const match = html.match(/№\s*(\d+)/);
  return match?.[1] ?? null;
};

// ─────────────────────────────────────────────────────────────────────────────
//  Экспортируемый CheckoutHandler
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Адаптер оформления заказа AvtoPartner (Drupal Commerce, avtopartner-yug.ru).
 *
 * Поток данных:
 *  1. ensureAvtoPartnerLoggedIn — cookie-based Drupal session.
 *  2. clearCart — GET /cart → POST /remove-line-item для каждой позиции (чистый старт).
 *  3. addAvtopartnerCart — HTML-scraping добавления позиций в корзину.
 *     Атомарность: если хотя бы одна позиция не добавлена — abort.
 *  4. GET /cart → валидация: артикулы и количества совпадают с ожидаемыми.
 *  5. Safety lock (AVTOPARTNER_ENABLE_REAL_ORDERS) — без флага заказ не создаётся.
 *  6. GET /checkout/{ORDER_ID} — парсинг Drupal CSRF-токенов (только checkout-форма).
 *  7. POST /checkout/{ORDER_ID} — подтверждение заказа (form submit → 302 → complete).
 *  8. Верификация страницы благодарности.
 */
export const avtoPartnerCheckoutHandler: CheckoutHandler = async (
  items: ICartItemDocument[],
  userLogger: Logger,
  _options?,
): Promise<CheckoutResult> => {
  const cartItemIds = items.map((i) => String(i._id));

  if (items.length === 0) {
    return {
      success: true,
      cartItemIds,
      externalOrderIds: [],
      providerResponseSnapshot: { adapter: 'avtoPartner', reason: 'empty_items' },
    };
  }

  try {
    // ── 1. Авторизация ──────────────────────────────────────────────────
    userLogger.info(`[${SUPPLIER_KEY}] Проверка авторизации перед checkout`, {
      itemCount: items.length,
    });
    await ensureAvtoPartnerLoggedIn();

    // ── 2. Очистка корзины ──────────────────────────────────────────────
    userLogger.info(`[${SUPPLIER_KEY}] Очистка корзины перед добавлением...`);
    const removedCount = await clearCart(userLogger);
    if (removedCount > 0) {
      userLogger.info(`[${SUPPLIER_KEY}] Удалено ${removedCount} старых позиций`);
      await pause(STEP_DELAY_MS);
    }

    // ── 3. Добавление позиций в корзину Drupal ──────────────────────────
    userLogger.info(`[${SUPPLIER_KEY}] Добавление ${items.length} позиций в корзину...`);

    const positions = items.map(cartItemToPosition);
    const cartResult = await addAvtopartnerCart(positions, SUPPLIER_KEY);

    const failedPositions = cartResult.positions.filter((p) => p.status === 0);

    if (failedPositions.length > 0) {
      const failures = failedPositions.map(
        (p) => `${p.brand}/${p.number}: ${p.errorMessage ?? 'неизвестная ошибка'}`,
      );
      userLogger.error(`[${SUPPLIER_KEY}] Частичный сбой при добавлении в корзину`, {
        failedCount: failedPositions.length,
        totalCount: items.length,
        failures,
      });
      return {
        success: false,
        cartItemIds,
        error: `Не удалось добавить ${failedPositions.length} из ${items.length} позиций: ${failures.join('; ')}`,
      };
    }

    userLogger.info(`[${SUPPLIER_KEY}] Все ${items.length} позиций добавлены`);
    await pause(STEP_DELAY_MS);

    // ── 4. Валидация корзины ────────────────────────────────────────────
    userLogger.info(`[${SUPPLIER_KEY}] GET /cart — валидация содержимого...`);

    const cartPageRes = await clientAvtoPartner.get('/cart');
    const cart = parseCartPage(cartPageRes.data as string);

    userLogger.info(`[${SUPPLIER_KEY}] Корзина: orderId=${cart.orderId}, позиций=${cart.items.length}`, {
      cartItems: cart.items.map((i) => `${i.article} x${i.quantity} (line:${i.lineId})`),
    });

    if (!cart.orderId) {
      userLogger.error(`[${SUPPLIER_KEY}] ORDER_ID не найден на странице /cart после добавления`);
      return {
        success: false,
        cartItemIds,
        error: 'ORDER_ID не найден на странице корзины после добавления позиций',
      };
    }

    const orderId = cart.orderId;
    const mismatch = validateCartContents(cart.items, positions);

    if (mismatch) {
      userLogger.error(`[${SUPPLIER_KEY}] Валидация корзины не пройдена`, {
        mismatch,
        expected: positions.map((p) => `${p.number} x${p.quantity}`),
        actual: cart.items.map((i) => `${i.article} x${i.quantity}`),
      });
      return {
        success: false,
        cartItemIds,
        error: `Содержимое корзины не совпадает с ожидаемым: ${mismatch}`,
      };
    }

    userLogger.info(`[${SUPPLIER_KEY}] Валидация пройдена — корзина соответствует ожиданиям`);

    // ── 5. Safety lock ──────────────────────────────────────────────────
    const realOrdersEnabled =
      process.env.AVTOPARTNER_ENABLE_REAL_ORDERS === 'true';

    if (!realOrdersEnabled) {
      userLogger.warn(
        `[${SUPPLIER_KEY}] Safety lock active — позиции в корзине, заказ НЕ оформлен`,
        { orderId, addedCount: items.length },
      );
      return {
        success: true,
        cartItemIds,
        externalOrderIds: [],
        note: `Safety lock active. ${items.length} позиций в корзине (ORDER_ID: ${orderId}). Установите AVTOPARTNER_ENABLE_REAL_ORDERS=true для реального оформления.`,
        providerResponseSnapshot: {
          adapter: 'avtoPartner',
          safetyLock: true,
          drupalCartOrderId: orderId,
          positionsInCart: items.length,
        },
      };
    }

    await pause(STEP_DELAY_MS);

    // ── 6. GET /checkout/{ORDER_ID} → Drupal CSRF-токены ────────────────
    userLogger.info(`[${SUPPLIER_KEY}] GET /checkout/${orderId} — парсинг формы...`);

    const checkoutRes = await clientAvtoPartner.get(`/checkout/${orderId}`);
    const checkoutHtml = checkoutRes.data as string;

    userLogger.info(`[${SUPPLIER_KEY}] Checkout page получен`, {
      status: checkoutRes.status,
      contentLength: checkoutHtml.length,
      url: checkoutRes.request?.res?.responseUrl ?? checkoutRes.config?.url,
    });

    const tokens = parseDrupalFormTokens(checkoutHtml, userLogger);

    if (!tokens) {
      userLogger.error(
        `[${SUPPLIER_KEY}] Не удалось извлечь CSRF-токены со страницы checkout`,
        { htmlSnippet: checkoutHtml.slice(0, HTML_DUMP_LIMIT) },
      );
      return {
        success: false,
        cartItemIds,
        error: 'form_build_id / form_token не найдены на странице оформления заказа',
      };
    }

    userLogger.info(`[${SUPPLIER_KEY}] CSRF-токены извлечены`, {
      formId: tokens.formId,
      formBuildId: tokens.formBuildId,
    });

    await pause(STEP_DELAY_MS);

    // ── 7. POST /checkout/{ORDER_ID} → подтверждение заказа ─────────────
    userLogger.info(
      `[${SUPPLIER_KEY}] POST /checkout/${orderId} — подтверждение заказа...`,
    );

    const confirmPayload = new URLSearchParams({
      op: 'Подтвердить заказ',
      form_build_id: tokens.formBuildId,
      form_token: tokens.formToken,
      form_id: tokens.formId,
    });

    /** axios следует 302-редиректу автоматически (maxRedirects: 5 в clientAvtoPartner). */
    const confirmRes = await clientAvtoPartner.post(
      `/checkout/${orderId}`,
      confirmPayload.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Referer: `https://avtopartner-yug.ru/checkout/${orderId}`,
        },
      },
    );

    const confirmHtml = confirmRes.data as string;
    const confirmFinalUrl =
      confirmRes.request?.res?.responseUrl ?? confirmRes.config?.url;

    userLogger.info(`[${SUPPLIER_KEY}] POST confirm — ответ получен`, {
      status: confirmRes.status,
      finalUrl: confirmFinalUrl,
      contentLength: confirmHtml.length,
      containsThankYou: isThankYouPage(confirmHtml),
    });

    // ── 8. Верификация страницы благодарности ────────────────────────────
    let completeHtml = confirmHtml;

    /**
     * POST возвращает 302 → /checkout/{ORDER_ID}/complete.
     * axios следует редиректу и отдаёт HTML complete-страницы.
     * Если по какой-то причине редирект не сработал — запрашиваем явно.
     */
    if (!isThankYouPage(completeHtml)) {
      userLogger.warn(
        `[${SUPPLIER_KEY}] POST не привёл на страницу благодарности, пробуем GET /checkout/${orderId}/complete...`,
        { htmlSnippet: completeHtml.slice(0, HTML_DUMP_LIMIT) },
      );
      await pause(STEP_DELAY_MS);

      const completeRes = await clientAvtoPartner.get(
        `/checkout/${orderId}/complete`,
      );
      completeHtml = completeRes.data as string;

      userLogger.info(`[${SUPPLIER_KEY}] GET /complete — ответ получен`, {
        status: completeRes.status,
        finalUrl: completeRes.request?.res?.responseUrl ?? completeRes.config?.url,
        contentLength: completeHtml.length,
        containsThankYou: isThankYouPage(completeHtml),
      });
    }

    if (!isThankYouPage(completeHtml)) {
      userLogger.error(
        `[${SUPPLIER_KEY}] Страница благодарности не обнаружена после подтверждения`,
        { htmlSnippet: completeHtml.slice(0, HTML_DUMP_LIMIT) },
      );
      return {
        success: false,
        cartItemIds,
        error:
          'Заказ отправлен, но страница подтверждения не содержит ожидаемого текста «Спасибо за заказ»',
      };
    }

    const confirmedId = extractConfirmedOrderId(completeHtml) ?? orderId;

    userLogger.info(
      `[${SUPPLIER_KEY}] Заказ #${confirmedId} успешно оформлен`,
      { orderId: confirmedId, itemCount: items.length },
    );

    return {
      success: true,
      cartItemIds,
      externalOrderIds: [confirmedId],
      providerResponseSnapshot: {
        adapter: 'avtoPartner',
        drupalCheckoutOrderId: orderId,
        thankYouPageOrderId: confirmedId,
      },
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : String(error);
    userLogger.error(`[${SUPPLIER_KEY}] Исключение при checkout: ${message}`);
    return {
      success: false,
      cartItemIds,
      error: `Ошибка оформления заказа AvtoPartner: ${message}`,
    };
  }
};

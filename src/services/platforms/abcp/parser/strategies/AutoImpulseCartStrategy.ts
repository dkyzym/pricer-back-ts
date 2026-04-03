import * as cheerio from 'cheerio';

import { logger } from '../../../../../config/logger/index.js';
import { abcpHeaders } from '../../../../../constants/headers.js';
import type { AbcpClient } from '../createHtmlClient.js';
import { parseExternalOrderIdFromHtml } from '../utils/parseOrderId.js';
import { parseAbcpAgreementId } from './MikanoCartStrategy.js';
import type { CartPosition, IAbcpCartStrategy } from './abcpStrategy.types.js';

/**
 * Браузерные хедеры для MAS-формы: AutoImpulse делает обычные POST-навигации (sec-fetch-dest: document),
 * при AJAX-хедерах (X-Requested-With) сервер может вернуть другой контент.
 */
const BROWSER_FORM_HEADERS = {
  'User-Agent': abcpHeaders['User-Agent'],
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Encoding': abcpHeaders['Accept-Encoding'],
  'Accept-Language': abcpHeaders['Accept-Language'],
  'Content-Type': 'application/x-www-form-urlencoded',
};

/**
 * Извлекает все поля формы оформления заказа из промежуточной страницы «Оформление заказа».
 * Нужны для второго шага (ordercomplete): tokenAcceptOrder, selected_delivaddr, selected_typepay и т.д.
 */
const extractOrderFormFields = ($: cheerio.CheerioAPI): Record<string, string> => {
  const fields: Record<string, string> = {};

  $('input[type="hidden"]').each((_, el) => {
    const name = $(el).attr('name');
    if (name) fields[name] = String($(el).val() ?? '');
  });

  $('input[type="radio"]:checked').each((_, el) => {
    const name = $(el).attr('name');
    if (name) fields[name] = String($(el).val() ?? '');
  });

  $('select').each((_, el) => {
    const name = $(el).attr('name');
    if (name) fields[name] = String($(el).val() ?? '');
  });

  $('input[type="text"], input:not([type])').each((_, el) => {
    const name = $(el).attr('name');
    if (name && !fields[name]) fields[name] = String($(el).val() ?? '');
  });

  $('textarea').each((_, el) => {
    const name = $(el).attr('name');
    if (name && !fields[name]) fields[name] = String($(el).val() ?? '');
  });

  return fields;
};

export class AutoImpulseCartStrategy implements IAbcpCartStrategy {
  parseAgreementId(html: string): string | null {
    return parseAbcpAgreementId(html);
  }

  extractPositions(html: string): CartPosition[] {
    const $ = cheerio.load(html);
    const positions: CartPosition[] = [];

    $('a.cartDeletePositionLink').each((_, el) => {
      const href = $(el).attr('href') || '';
      const match = href.match(/removepos=(\d+)/i);

      if (match && match[1]) {
        const id = parseInt(match[1], 10);
        const $tr = $(el).closest('tr');

        const masQtyStr = $(`input[name="mas_quantity[${id}]"]`).val();
        const closestQtyStr = $tr.find('input.quantityInput, input[name="quantity"]').val();

        const rawQty = masQtyStr ?? closestQtyStr ?? '1';
        const quantity = Math.max(1, parseInt(String(rawQty), 10) || 1);

        const article = $tr.find('.brandNumberText').first().text().trim();
        const priceRaw = $tr.find('.cartPriceCell').first().text().replace(/,/g, '.');
        const priceCleaned = priceRaw.replace(/[^\d.]/g, '');
        const priceParsed = parseFloat(priceCleaned);
        const price = Number.isFinite(priceParsed) ? priceParsed : 0;

        positions.push({ id, quantity, article, price });
      }
    });

    return positions;
  }

  /**
   * Очистка корзины MAS: один POST на /cart с тем же телом, что и кнопка «Очистить корзину» в браузере.
   * Axios по умолчанию следует 302 после POST — отдельная настройка не требуется.
   */
  async clearCart(
    client: AbcpClient,
    positions: CartPosition[],
    cartUrl: string,
  ): Promise<number> {
    const { baseUrl } = client.config;
    const payload = new URLSearchParams();
    payload.set('old_profile_select', '/');
    payload.set('cartClear', '1');
    payload.set('refreshpage', 'basket');
    payload.set('select-all-mas', 'on');
    payload.set('quantity', '1');

    for (const pos of positions) {
      payload.set(`mas_is_send[${pos.id}]`, 'on');
      payload.set(`mas_quantity[${pos.id}]`, String(pos.quantity));
      payload.set(`mas_comment[${pos.id}]`, '');
    }

    await client.makePostRequest(`${baseUrl}/cart`, payload.toString(), {
      headers: {
        ...abcpHeaders,
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: cartUrl,
      },
    });

    return positions.length;
  }

  /**
   * MAS двухшаговый чекаут AutoImpulse:
   *   Шаг 1: POST /cart/?acceptorder → промежуточная страница «Оформление заказа» (форма с доставкой/оплатой/token).
   *   Шаг 2: POST /cart?ordercomplete  с sendorder=1 + tokenAcceptOrder → HTML с «Заказу присвоен номер …».
   */
  async submitOrder(
    client: AbcpClient,
    positions: CartPosition[],
    agreementId: string | null,
    cartUrl: string,
  ): Promise<{ success: boolean; externalOrderId?: string; error?: string }> {
    if (process.env.ABCP_ENABLE_REAL_ORDERS_HTML !== 'true') {
      return { success: true, externalOrderId: `dryrun-${Date.now()}` };
    }

    const { baseUrl } = client.config;

    try {
      // --- Шаг 1: POST /cart/?acceptorder ---
      const step1Payload = new URLSearchParams();
      step1Payload.append('old_profile_select', '/');
      step1Payload.append('refreshpage', 'basket');
      step1Payload.append('select-all-mas', 'on');
      step1Payload.append(
        'quantity',
        String(positions.reduce((s, p) => s + p.quantity, 0)),
      );

      if (agreementId) {
        step1Payload.append('agreementSelect', agreementId);
      }

      for (const pos of positions) {
        step1Payload.append(`mas_is_send[${pos.id}]`, 'on');
        step1Payload.append(`mas_quantity[${pos.id}]`, String(pos.quantity));
        step1Payload.append(`mas_comment[${pos.id}]`, '');
      }

      step1Payload.append('anonymOrder', '');

      const step1Res = await client.makePostRequest(
        `${baseUrl}/cart/?acceptorder`,
        step1Payload.toString(),
        {
          headers: {
            ...BROWSER_FORM_HEADERS,
            Origin: baseUrl,
            Referer: `${baseUrl}/cart`,
          },
        },
      );

      const step1Html = String(step1Res.data ?? '');

      logger.debug('[AutoImpulseCheckout] Step 1 (/cart/?acceptorder)', {
        supplier: client.config.supplierName,
        htmlLength: step1Html.length,
        hasОформление: /Оформление заказа/i.test(step1Html),
        snippet: step1Html.slice(0, 300),
      });

      const earlyOrderId = parseExternalOrderIdFromHtml(step1Html);
      if (earlyOrderId && /принят|оформлен/i.test(step1Html)) {
        return { success: true, externalOrderId: earlyOrderId };
      }

      // --- Парсим промежуточную страницу: извлекаем все поля формы ---
      const $ = cheerio.load(step1Html);
      const formFields = extractOrderFormFields($);

      const tokenAcceptOrder = formFields['tokenAcceptOrder'];
      if (!tokenAcceptOrder) {
        logger.warn('[AutoImpulseCheckout] tokenAcceptOrder не найден', {
          supplier: client.config.supplierName,
          formFieldKeys: Object.keys(formFields),
        });
        return {
          success: false,
          error:
            'Промежуточная страница «Оформление заказа» не содержит tokenAcceptOrder — невозможно завершить оформление',
        };
      }

      // --- Шаг 2: POST /cart?ordercomplete ---
      const step2Payload = new URLSearchParams();

      for (const [key, value] of Object.entries(formFields)) {
        step2Payload.set(key, value);
      }

      step2Payload.set('sendorder', '1');
      step2Payload.set('tokenAcceptOrder', tokenAcceptOrder);

      if (!step2Payload.get('is-new-client')) {
        step2Payload.set('is-new-client', 'false');
      }
      if (!step2Payload.get('isValidTiedCar')) {
        step2Payload.set('isValidTiedCar', 'true');
      }
      if (!step2Payload.get('mandatoryAttachCarToPosition')) {
        step2Payload.set('mandatoryAttachCarToPosition', '0');
      }
      if (!step2Payload.get('vin')) {
        step2Payload.set('vin', 'vin');
      }

      const step2Res = await client.makePostRequest(
        `${baseUrl}/cart?ordercomplete`,
        step2Payload.toString(),
        {
          headers: {
            ...BROWSER_FORM_HEADERS,
            Origin: baseUrl,
            Referer: `${baseUrl}/cart/?acceptorder`,
          },
        },
      );

      const step2Html = String(step2Res.data ?? '');

      logger.debug('[AutoImpulseCheckout] Step 2 (/cart?ordercomplete)', {
        supplier: client.config.supplierName,
        htmlLength: step2Html.length,
        hasПринят: /принят/i.test(step2Html),
        hasНомер: /присвоен\s+номер/i.test(step2Html),
        snippet: step2Html.slice(0, 400),
      });

      const orderId = parseExternalOrderIdFromHtml(step2Html);
      if (orderId) {
        return { success: true, externalOrderId: orderId };
      }

      return {
        success: false,
        error:
          'Второй шаг (ordercomplete) не вернул номер заказа в HTML-ответе',
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }
}

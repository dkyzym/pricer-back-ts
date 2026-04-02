import * as cheerio from 'cheerio';

import { abcpHeaders } from '../../../../../constants/headers.js';
import type { AbcpClient } from '../createHtmlClient.js';
import { parseExternalOrderIdFromHtml } from '../utils/parseOrderId.js';
import { parseAbcpAgreementId } from './MikanoCartStrategy.js';
import type { CartPosition, IAbcpCartStrategy } from './abcpStrategy.types.js';

export class AutoImpulseCartStrategy implements IAbcpCartStrategy {
  parseAgreementId(html: string): string | null {
    return parseAbcpAgreementId(html);
  }

  extractPositions(html: string): CartPosition[] {
    const $ = cheerio.load(html);
    const positions: CartPosition[] = [];

    // Ищем все ссылки на удаление позиций
    $('a.cartDeletePositionLink').each((_, el) => {
      const href = $(el).attr('href') || '';
      // Извлекаем ID из href="/cart/?removepos=734602812"
      const match = href.match(/removepos=(\d+)/i);

      if (match && match[1]) {
        const id = parseInt(match[1], 10);

        // В теме MAS количество лежит в input с именем mas_quantity[ID] или quantity
        const masQtyStr = $(`input[name="mas_quantity[${id}]"]`).val();

        // Фолбэк на случай, если структура чуть отличается, ищем ближайший инпут quantity
        const closestQtyStr = $(el).closest('tr').find('input.quantityInput, input[name="quantity"]').val();

        const rawQty = masQtyStr ?? closestQtyStr ?? '1';
        const quantity = Math.max(1, parseInt(String(rawQty), 10) || 1);

        positions.push({ id, quantity });
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

  /** MAS: оформление через POST формы на /cart (кнопка «Оформить заказ»), без ajaxRoute/cart/createOrder. */
  async submitOrder(
    client: AbcpClient,
    positions: CartPosition[],
    agreementId: string | null,
    cartUrl: string,
  ): Promise<{ success: boolean; externalOrderId?: string; error?: string }> {
    if (process.env.ABCP_ENABLE_REAL_ORDERS !== 'true') {
      return { success: true, externalOrderId: `dryrun-${Date.now()}` };
    }

    const { baseUrl } = client.config;
    const payload = new URLSearchParams();
    payload.append('old_profile_select', '/');
    payload.append('order_go', 'Оформить заказ');

    if (agreementId) {
      payload.append('agreementSelect', agreementId);
    }

    for (const pos of positions) {
      payload.append(`mas_is_send[${pos.id}]`, 'on');
      payload.append(`mas_quantity[${pos.id}]`, String(pos.quantity));
      payload.append(`mas_comment[${pos.id}]`, '');
    }

    try {
      const response = await client.makePostRequest(
        `${baseUrl}/cart`,
        payload.toString(),
        {
          headers: {
            ...abcpHeaders,
            'Content-Type': 'application/x-www-form-urlencoded',
            Referer: cartUrl,
          },
        },
      );

      const finalHtml = String(response.data ?? '');
      const parsed = parseExternalOrderIdFromHtml(finalHtml);
      if (parsed) {
        return { success: true, externalOrderId: parsed };
      }

      return {
        success: false,
        error: 'Заказ отправлен, но номер не найден в HTML',
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { success: false, error: message };
    }
  }
}

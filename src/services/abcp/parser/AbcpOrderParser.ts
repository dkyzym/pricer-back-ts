import * as cheerio from 'cheerio';
import { OrderStatus, UnifiedOrderItem } from '../../orders/orders.types.js';

// --- Mappings ---

const STATUS_MAP: Record<string, OrderStatus> = {
  // Positive / Active
  новая: 'pending',
  'в обработке': 'pending',
  'отправлено поставщику': 'pending',
  заказано: 'work',
  'в работе': 'work',
  подтвержден: 'work',
  'в пути': 'shipping',
  отгружено: 'shipping',
  'на складе': 'ready',
  'готово к выдаче': 'ready',
  пришло: 'ready',

  // Finished
  выдано: 'finished',
  'выдано клиенту': 'finished',
  архив: 'finished',

  // Negative
  отказ: 'refused',
  'нет в наличии': 'refused',
  снято: 'refused',
};

export class AbcpOrderParser {
  /**
   * Парсит HTML страницу с историей заказов ABCP.
   * Автоматически определяет тип верстки (Блочная или Табличная).
   */
  public parse(html: string, supplier: string): UnifiedOrderItem[] {
    const $ = cheerio.load(html);

    // Стратегия 1: Блочная верстка (как у Mikano)
    if ($('.allOrdersOrder').length > 0) {
      return this.parseBlockLayout($, supplier);
    }

    // Стратегия 2: Табличная верстка (как у AutoImpulse)
    // FIX: Проверяем наличие строк с data-order-id, это надежнее чем классы
    if ($('tr[data-order-id]').length > 0) {
      return this.parseTableLayout($, supplier);
    }

    return [];
  }

  /**
   * Парсинг табличной верстки (AutoImpulse)
   * Используем tr[data-order-id], чтобы поймать ВСЕ строки
   */
  private parseTableLayout(
    $: cheerio.CheerioAPI,
    supplier: string
  ): UnifiedOrderItem[] {
    const result: UnifiedOrderItem[] = [];

    $('tr[data-order-id]').each((rowIndex, rowEl) => {
      const $row = $(rowEl);
      const $tds = $row.find('td');

      // 1. Номер заказа и ID строки из data-атрибутов (Самый надежный источник)
      const orderId = $row.attr('data-order-id') || $tds.eq(1).text().trim();

      // 2. Дата (обычно 1-я колонка)
      const dateText =
        $row.find('.wrapper-date').text().trim() || $tds.eq(0).text().trim();
      const createdAt = this.parseDate(dateText);

      // 3. Бренд (3-я колонка, index 2)
      const brand = $tds.eq(2).text().trim();

      // 4. Артикул (4-я колонка, index 3)
      // Часто внутри .columnArticlePosition, но лучше брать текст ячейки целиком и чистить
      const article =
        $row.find('.columnArticlePosition').text().trim() ||
        $tds.eq(3).text().trim();

      // 5. Наименование
      const name = $row
        .find('.allOrdersListDescription')
        .text()
        .replace(/\s+/g, ' ')
        .trim();

      // 6. Количество (8-я колонка, index 7)
      const quantityRaw = $tds.eq(7).text().trim();
      const quantity = parseInt(quantityRaw.replace(/\D/g, ''), 10) || 1;

      // 7. Цена (10-я колонка, index 9)
      // FIX: Берем из data-атрибута, если он есть (надежнее)
      const priceAttr = $row.attr('data-position-price');
      const priceRaw = priceAttr || $tds.eq(9).text().trim();
      const price = this.parsePrice(priceRaw);

      // 8. Сумма
      const totalPrice = Number((price * quantity).toFixed(2));

      // 9. Статус
      const statusRaw = $row.find('.orderPosStatus').text().trim();
      const status = this.mapStatus(statusRaw);

      // Генерация ID
      // Используем data-position-id если есть, это гарантия уникальности от ABCP
      const positionId = $row.attr('data-position-id');
      const id = positionId
        ? `${supplier}_${positionId}`
        : `${supplier}_${orderId}_${article}_${rowIndex}`;

      result.push({
        id,
        orderId,
        supplier,
        brand,
        article,
        name,
        quantity,
        price,
        totalPrice,
        currency: 'RUB',
        status,
        statusRaw,
        createdAt,
      });
    });

    return result;
  }

  /**
   * Парсинг блочной верстки (Mikano)
   */
  private parseBlockLayout(
    $: cheerio.CheerioAPI,
    supplier: string
  ): UnifiedOrderItem[] {
    const result: UnifiedOrderItem[] = [];

    $('.allOrdersOrder').each((_, orderEl) => {
      const $order = $(orderEl);

      const headerInfo = $order
        .find('.allOrdersOrder__header__info')
        .text()
        .trim();
      const orderId = $order
        .find('.allOrdersOrder__header__info strong')
        .text()
        .trim();
      const createdAt = this.parseDate(headerInfo);

      const $rows = $order.find('.allOrdersOrder__row');

      $rows.each((rowIndex, rowEl) => {
        const $row = $(rowEl);

        const brand = $row.find('.allOrdersOrder__productBrand').text().trim();
        const article = $row
          .find('.allOrdersOrder__productNumber')
          .text()
          .trim();
        const name = $row
          .find('.allOrdersOrder__item_descr')
          .text()
          .replace(/\s+/g, ' ')
          .trim();

        const quantityRaw = $row
          .find('.allOrdersOrder__item_quantity span')
          .first()
          .text()
          .trim();
        const quantity = parseInt(quantityRaw.replace(/\D/g, ''), 10) || 1;

        const priceRaw = $row
          .find('.allOrdersOrder__item_price')
          .last()
          .text()
          .trim();
        const price = this.parsePrice(priceRaw);
        const totalPrice = Number((price * quantity).toFixed(2));

        const statusRaw = $row.find('.statusName').text().trim();
        const status = this.mapStatus(statusRaw);

        const id = `${supplier}_${orderId}_${article}_${rowIndex}`;

        result.push({
          id,
          orderId,
          supplier,
          brand,
          article,
          name,
          quantity,
          price,
          totalPrice,
          currency: 'RUB',
          status,
          statusRaw,
          createdAt,
        });
      });
    });

    return result;
  }

  // --- Helpers ---

  private parseDate(raw: string): string {
    const dateMatch = raw.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    if (dateMatch) {
      const dateObj = new Date(
        parseInt(dateMatch[3], 10),
        parseInt(dateMatch[2], 10) - 1,
        parseInt(dateMatch[1], 10)
      );
      return dateObj.toISOString();
    }
    return new Date().toISOString();
  }

  private parsePrice(raw: string): number {
    if (!raw) return 0;
    const clean = raw.replace(/\s/g, '').replace('₽', '').replace(',', '.');

    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  }

  private mapStatus(raw: string): OrderStatus {
    const lower = raw.toLowerCase();

    if (STATUS_MAP[lower]) {
      return STATUS_MAP[lower];
    }

    for (const [key, val] of Object.entries(STATUS_MAP)) {
      if (lower.includes(key)) {
        return val;
      }
    }

    return 'unknown';
  }
}

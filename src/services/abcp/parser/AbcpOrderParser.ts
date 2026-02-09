import * as cheerio from 'cheerio';
import { OrderStatus, UnifiedOrderItem } from '../../orders/orders.types.js';

// --- Constants & Types ---

type LayoutStrategy = (
  $: cheerio.CheerioAPI,
  supplier: string
) => UnifiedOrderItem[];

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

// --- Helpers (Pure) ---

const cleanText = (text: string | undefined): string =>
  text ? text.replace(/\s+/g, ' ').trim() : '';

const parsePrice = (raw: string | undefined): number => {
  if (!raw) return 0;
  // Удаляем пробелы, знак рубля, меняем запятую на точку
  const clean = raw.replace(/\s/g, '').replace('₽', '').replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};

const parseDate = (raw: string | undefined): string => {
  if (!raw) return new Date().toISOString();

  const dateMatch = raw.match(/(\d{2})\.(\d{2})\.(\d{4})/);
  if (dateMatch) {
    // Месяцы в JS 0-indexed
    const dateObj = new Date(
      parseInt(dateMatch[3], 10),
      parseInt(dateMatch[2], 10) - 1,
      parseInt(dateMatch[1], 10)
    );
    return dateObj.toISOString();
  }
  return new Date().toISOString();
};

const mapStatus = (raw: string): OrderStatus => {
  const lower = raw.toLowerCase();

  // 1. Прямое совпадение (O(1))
  if (STATUS_MAP[lower]) {
    return STATUS_MAP[lower];
  }

  // 2. Поиск подстроки (O(N)) - fallback
  const foundEntry = Object.entries(STATUS_MAP).find(([key]) =>
    lower.includes(key)
  );
  return foundEntry ? foundEntry[1] : 'unknown';
};

// --- Strategies ---

/**
 * Стратегия для табличной верстки (AutoImpulse и подобные).
 * Опирается на data-order-id как признак строки заказа.
 */
const parseTableLayout: LayoutStrategy = ($, supplier) => {
  const rows = $('tr[data-order-id]');
  if (rows.length === 0) return [];

  return rows.toArray().map((rowEl) => {
    const $row = $(rowEl);
    const $tds = $row.find('td');

    // Data Extraction
    const orderId = $row.attr('data-order-id') || cleanText($tds.eq(1).text());
    const dateText =
      cleanText($row.find('.wrapper-date').text()) ||
      cleanText($tds.eq(0).text());
    const brand = cleanText($tds.eq(2).text());

    // Артикул: приоритет классу, фоллбэк на колонку
    const article =
      cleanText($row.find('.columnArticlePosition').text()) ||
      cleanText($tds.eq(3).text());

    const name = cleanText($row.find('.allOrdersListDescription').text());

    const quantityRaw = cleanText($tds.eq(7).text());
    const quantity = parseInt(quantityRaw.replace(/\D/g, ''), 10) || 1;

    const priceAttr = $row.attr('data-position-price');
    const price = parsePrice(priceAttr || $tds.eq(9).text());

    const statusRaw = cleanText($row.find('.orderPosStatus').text());

    // ID Generation
    const positionId = $row.attr('data-position-id');
    // Используем индекс строки как соль, если нет positionId
    const rowIndex = $row.index();
    const id = positionId
      ? `${supplier}_${positionId}`
      : `${supplier}_${orderId}_${article}_${rowIndex}`;

    return {
      id,
      orderId,
      supplier,
      brand,
      article,
      name,
      quantity,
      price,
      totalPrice: Number((price * quantity).toFixed(2)),
      currency: 'RUB',
      status: mapStatus(statusRaw),
      statusRaw,
      createdAt: parseDate(dateText),
    };
  });
};

/**
 * Стратегия для блочной верстки (Mikano).
 * Вложенная структура: Заказ -> Строки позиций.
 */
const parseBlockLayout: LayoutStrategy = ($, supplier) => {
  const orders = $('.allOrdersOrder');
  if (orders.length === 0) return [];

  // flatMap позволяет развернуть структуру "Заказы -> Позиции" в плоский список "Позиции"
  return orders.toArray().flatMap((orderEl) => {
    const $order = $(orderEl);

    // Header Info
    const headerInfo = cleanText(
      $order.find('.allOrdersOrder__header__info').text()
    );
    const orderId = cleanText(
      $order.find('.allOrdersOrder__header__info strong').text()
    );
    const createdAt = parseDate(headerInfo);

    // Rows Processing
    return $order
      .find('.allOrdersOrder__row')
      .toArray()
      .reduce<UnifiedOrderItem[]>((acc, rowEl, index) => {
        const $row = $(rowEl);

        const article = cleanText(
          $row.find('.allOrdersOrder__productNumber').text()
        );

        // VALIDATION GUARD:
        // Вместо `if (!article) return` (костыль), мы используем reduce.
        // Если данных недостаточно для формирования валидной сущности, мы просто не добавляем её в аккумулятор.
        if (!article) {
          return acc;
        }

        const brand = cleanText(
          $row.find('.allOrdersOrder__productBrand').text()
        );
        const name = cleanText($row.find('.allOrdersOrder__item_descr').text());

        const quantityRaw = cleanText(
          $row.find('.allOrdersOrder__item_quantity span').first().text()
        );
        const quantity = parseInt(quantityRaw.replace(/\D/g, ''), 10) || 1;

        const priceRaw = cleanText(
          $row.find('.allOrdersOrder__item_price').last().text()
        );
        const price = parsePrice(priceRaw);

        const statusRaw = cleanText($row.find('.statusName').first().text());

        const id = `${supplier}_${orderId}_${article}_${index}`;

        acc.push({
          id,
          orderId,
          supplier,
          brand,
          article,
          name,
          quantity,
          price,
          totalPrice: Number((price * quantity).toFixed(2)),
          currency: 'RUB',
          status: mapStatus(statusRaw),
          statusRaw,
          createdAt,
        });

        return acc;
      }, []);
  });
};

// --- Main Parser Function ---

/**
 * Основная функция парсинга.
 * Применяет стратегии по очереди.
 */
export const parseAbcpHtml = (
  html: string,
  supplier: string
): UnifiedOrderItem[] => {
  if (!html) return [];

  const $ = cheerio.load(html);

  // Список стратегий. Порядок важен, если есть риск ложных срабатываний,
  // но здесь мы проверяем конкретные селекторы внутри стратегий.
  const strategies = [parseBlockLayout, parseTableLayout];

  for (const strategy of strategies) {
    const results = strategy($, supplier);
    if (results.length > 0) {
      return results;
    }
  }

  return [];
};

// Для обратной совместимости, если где-то используется как тип
export type AbcpParserFn = typeof parseAbcpHtml;

import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  parseHistoryPageHtml,
  parseOrderDetailsHtml,
  type AvtoPartnerOrderSummary,
} from './ordersAvtoPartnerService.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

test('parseHistoryPageHtml: парсит строки таблицы истории заказов', () => {
  const html = readFileSync(
    join(__dirname, 'temp.markup.orders.history.html'),
    'utf-8'
  );
  const rows = parseHistoryPageHtml(html);
  assert.ok(rows.length >= 3);
  const first = rows[0];
  assert.strictEqual(first.orderId, '131132');
  assert.ok(first.userOrderUrl.includes('/orders/131132'));
  assert.ok(first.createdAt.includes('2026') && first.createdAt.includes('03'));
  assert.strictEqual(first.statusRaw, 'Принят в работу');
  assert.ok(first.total > 0);

  const second = rows[1];
  assert.strictEqual(second.orderId, '131070');
  assert.ok(second.createdAt.includes('2026'));
});

test('parseOrderDetailsHtml: парсит позиции заказа из страницы деталей', () => {
  const html = readFileSync(join(__dirname, 'temp.order.html'), 'utf-8');
  const summary: AvtoPartnerOrderSummary = {
    orderId: '131132',
    userOrderUrl: '/user/301534/orders/131132',
    createdAt: '2026-03-06T00:00:00.000Z',
    total: 4951.08,
    statusRaw: 'Принят в работу',
  };
  const items = parseOrderDetailsHtml(html, summary);
  assert.strictEqual(items.length, 3);

  const first = items[0];
  assert.strictEqual(first.orderId, '131132');
  assert.strictEqual(first.supplier, 'avtoPartner');
  assert.strictEqual(first.brand, 'ЛУКОЙЛ');
  assert.strictEqual(first.article, '2255948');
  assert.ok(first.name.includes('ЛУКОЙЛ'));
  assert.strictEqual(first.quantity, 2);
  assert.ok(first.price > 0);
  assert.strictEqual(first.status, 'work');
  assert.ok(first.createdAt.includes('2026'));
  assert.ok(items.every((item) => item.brand.length > 0));

  const second = items[1];
  assert.strictEqual(second.article, '2389901318');
  assert.strictEqual(second.quantity, 1);
});

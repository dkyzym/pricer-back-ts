import mongoose from 'mongoose';
import axios from 'axios';
import { logger } from '../../config/logger/index.js';
import { Order } from '../../models/Order.js';
import type { UnifiedOrderItem } from '../orders/orders.types.js';

const TELEGRAM_API = 'https://api.telegram.org';
const MAX_MESSAGE_LENGTH = 4096;

function splitTextIntoChunks(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text];

  const lines = text.split('\n');
  const chunks: string[] = [];
  let current = '';

  for (const line of lines) {
    const candidate = current ? `${current}\n${line}` : line;
    if (candidate.length > maxLength) {
      if (current) chunks.push(current);
      current = line.length > maxLength ? line.slice(0, maxLength) : line;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);

  return chunks;
}

interface RefusedDoc {
  _id: mongoose.Types.ObjectId;
  id: string;
  orderId: string;
  supplier: string;
  brand: string;
  article: string;
  name: string;
  quantity: number;
  price: number;
  totalPrice: number;
  currency: string;
  statusRaw: string;
  providerCreatedAt: Date;
}

function docToItem(doc: RefusedDoc): UnifiedOrderItem {
  const createdAt =
    doc.providerCreatedAt instanceof Date
      ? doc.providerCreatedAt.toISOString()
      : String(doc.providerCreatedAt ?? '');
  return {
    id: doc.id,
    orderId: doc.orderId,
    supplier: doc.supplier,
    brand: doc.brand,
    article: doc.article,
    name: doc.name,
    quantity: doc.quantity,
    price: doc.price,
    totalPrice: doc.totalPrice,
    currency: doc.currency,
    status: 'refused',
    statusRaw: doc.statusRaw,
    createdAt,
  };
}

function formatOrderDate(isoDate: string): string {
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatOrderGroup(items: UnifiedOrderItem[]): string {
  const first = items[0];
  const lines: string[] = [
    `📋 Заказ #${first.orderId}`,
    `Поставщик: ${first.supplier}`,
    `Дата заказа: ${formatOrderDate(first.createdAt)}`,
    `Статус: ${first.statusRaw}`,
    '',
    'Позиции (отказ):',
  ];
  for (const it of items) {
    lines.push(
      `• ${it.article} | ${it.name} | ${it.quantity} шт. | ${it.price} ${it.currency} | ${it.totalPrice} ${it.currency}`
    );
  }
  return lines.join('\n');
}

function groupByOrder(docs: RefusedDoc[]): RefusedDoc[][] {
  const map = new Map<string, RefusedDoc[]>();
  for (const doc of docs) {
    const createdAt = doc.providerCreatedAt instanceof Date
      ? doc.providerCreatedAt.toISOString()
      : String(doc.providerCreatedAt ?? '');
    const key = `${doc.supplier}|${doc.orderId}|${createdAt}`;
    const list = map.get(key) ?? [];
    list.push(doc);
    map.set(key, list);
  }
  return Array.from(map.values());
}

/**
 * Находит в БД отказы без отметки об отправке, шлёт уведомления в MANAGER_CHAT_ID
 * и проставляет refusalNotifiedAt только после успешной отправки.
 */
export async function sendRefusedOrdersNotification(): Promise<void> {
  const token = process.env.BOT_TOKEN;
  const chatId = process.env.MANAGER_CHAT_ID;

  if (!token?.trim() || !chatId?.trim()) {
    logger.debug('[telegram] BOT_TOKEN или MANAGER_CHAT_ID не заданы, уведомления пропущены');
    return;
  }

  const refused = await Order.find({
    status: 'refused',
    refusalNotifiedAt: null,
  })
    .lean()
    .exec();

  if (refused.length === 0) return;

  const groups = groupByOrder(refused as RefusedDoc[]);
  const url = `${TELEGRAM_API}/bot${token}/sendMessage`;
  const now = new Date();
  let sentCount = 0;

  for (const group of groups) {
    const items = group.map((d) => docToItem(d));
    const text = formatOrderGroup(items);
    const chunks = splitTextIntoChunks(text, MAX_MESSAGE_LENGTH);

    let allSent = true;
    for (const chunk of chunks) {
      try {
        await axios.post(url, {
          chat_id: chatId,
          text: chunk,
          disable_web_page_preview: true,
        });
      } catch (err) {
        allSent = false;
        logger.error('[telegram] Ошибка отправки уведомления об отказе', {
          orderId: group[0].orderId,
          supplier: group[0].supplier,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (allSent) {
      const ids = group.map((d) => d._id);
      await Order.updateMany(
        { _id: { $in: ids } },
        { $set: { refusalNotifiedAt: now } }
      ).exec();
      sentCount += group.length;
    }
  }

  if (sentCount > 0) {
    logger.info('[telegram] Отправлены уведомления об отказах (зафиксированы)', {
      sentCount,
      ordersCount: groups.length,
    });
  }
}

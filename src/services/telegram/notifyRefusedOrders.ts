import axios from 'axios';
import mongoose from 'mongoose';
import { logger } from '../../config/logger/index.js';
import { Order } from '../../models/Order.js';
import type { UnifiedOrderItem } from '../orders/orders.types.js';

const TELEGRAM_API = 'https://api.telegram.org';
const MAX_MESSAGE_LENGTH = 4096;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
  providerCreatedAt: Date | string;
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
 * Находит в БД отказы без отметки об отправке, шлёт уведомления списку менеджеров
 * и проставляет refusalNotifiedAt, если сообщение доставлено хотя бы одному.
 */
export async function sendRefusedOrdersNotification(): Promise<void> {
  const token = process.env.BOT_TOKEN;
  const rawIds = process.env.MANAGER_CHAT_IDS;

  if (!token?.trim() || !rawIds?.trim()) {
    logger.debug('[telegram] BOT_TOKEN или MANAGER_CHAT_IDS не заданы, уведомления пропущены');
    return;
  }

  const chatIds = rawIds.split(',').map(id => id.trim()).filter(Boolean);
  if (chatIds.length === 0) {
    logger.debug('[telegram] Список MANAGER_CHAT_IDS пуст после парсинга');
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

    let isDeliveredToAtLeastOne = false;

    for (const chunk of chunks) {
      for (const chatId of chatIds) {
        try {
          await axios.post(url, {
            chat_id: chatId,
            text: chunk,
            disable_web_page_preview: true,
          });
          isDeliveredToAtLeastOne = true;
        } catch (err) {
          logger.error('[telegram] Ошибка отправки уведомления об отказе юзеру', {
            chatId,
            orderId: group[0].orderId,
            supplier: group[0].supplier,
            error: err instanceof Error ? err.message : String(err),
          });
        } finally {
          // Гарантированная пауза даже при ошибке, чтобы не нарваться на бан от API
          await delay(100);
        }
      }
    }

    if (isDeliveredToAtLeastOne) {
      const ids = group.map((d) => d._id);
      await Order.updateMany(
        { _id: { $in: ids } },
        { $set: { refusalNotifiedAt: now } }
      ).exec();
      sentCount += group.length;
    } else {
      logger.warn('[telegram] Группа отказов не доставлена НИ ОДНОМУ получателю', {
        orderId: group[0].orderId
      });
    }
  }

  if (sentCount > 0) {
    logger.info('[telegram] Отправлены уведомления об отказах (зафиксированы)', {
      sentCount,
      ordersCount: groups.length,
      recipientsCount: chatIds.length
    });
  }
}
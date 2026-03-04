import mongoose, { Document, Schema } from 'mongoose';
import type { OrderStatus, UnifiedOrderItem } from '../services/orders/orders.types.js';

const ORDER_STATUS_VALUES: OrderStatus[] = [
  'pending',
  'work',
  'shipping',
  'ready',
  'finished',
  'refused',
  'unknown',
];

/**
 * Интерфейс документа заказа в MongoDB.
 * Расширяет Document от Mongoose.
 * providerCreatedAt — оригинальная дата заказа у поставщика.
 * createdAt/updatedAt — системные поля от timestamps (время записи в БД).
 */
export interface IOrderDocument extends Document {
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
  status: OrderStatus;
  statusRaw: string;
  providerCreatedAt: Date;
  deliveryDate?: Date;
  comment?: string;
  rawProviderData?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const orderSchema = new Schema<IOrderDocument>(
  {
    id: { type: String, required: true },
    orderId: { type: String, required: true },
    supplier: { type: String, required: true },
    brand: { type: String, required: true },
    article: { type: String, required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
    currency: { type: String, required: true, default: 'RUB' },
    status: { type: String, required: true, enum: ORDER_STATUS_VALUES },
    statusRaw: { type: String, required: true },
    providerCreatedAt: { type: Date, required: true },
    deliveryDate: { type: Date, required: false },
    comment: { type: String, required: false },
    rawProviderData: { type: Schema.Types.Mixed, required: false },
  },
  {
    id: false,
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>, _options): UnifiedOrderItem {
        const providerCreatedAt = ret.providerCreatedAt as Date | undefined;
        const deliveryDate = ret.deliveryDate as Date | undefined;

        const result: UnifiedOrderItem = {
          id: ret.id as string,
          orderId: ret.orderId as string,
          supplier: ret.supplier as string,
          brand: ret.brand as string,
          article: ret.article as string,
          name: ret.name as string,
          quantity: ret.quantity as number,
          price: ret.price as number,
          totalPrice: ret.totalPrice as number,
          currency: ret.currency as string,
          status: ret.status as OrderStatus,
          statusRaw: ret.statusRaw as string,
          createdAt:
            providerCreatedAt instanceof Date
              ? providerCreatedAt.toISOString()
              : String(providerCreatedAt ?? ''),
        };

        if (deliveryDate instanceof Date) {
          result.deliveryDate = deliveryDate.toISOString();
        } else if (typeof deliveryDate === 'string') {
          result.deliveryDate = deliveryDate;
        }

        if (typeof ret.comment === 'string') {
          result.comment = ret.comment;
        }

        return result;
      },
    },
  }
);

orderSchema.index({ supplier: 1, id: 1 }, { unique: true });
orderSchema.index({ providerCreatedAt: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ orderId: 1 });

export const Order = mongoose.model<IOrderDocument>('Order', orderSchema);

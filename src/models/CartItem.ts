import mongoose, { Document, Schema } from 'mongoose';

/** Допустимые статусы позиции виртуальной корзины (жизненный цикл до оформления заказа). */
export type CartItemStatus = 'draft' | 'approved' | 'ordered' | 'cancelled';

const CART_ITEM_STATUS_VALUES: CartItemStatus[] = [
  'draft',
  'approved',
  'ordered',
  'cancelled',
];

/**
 * Документ позиции виртуальной корзины в MongoDB.
 * username связывает запись с пользователем из JWT; rawItemData сохраняет исходный объект поиска для последующих шагов заказа.
 */
export interface ICartItemDocument extends Document {
  username: string;
  supplier: string;
  article: string;
  brand: string;
  name: string;
  quantity: number;
  initialPrice: number;
  /** Актуальная цена после последней актуализации (null — ещё не проверялась). */
  currentPrice: number | null;
  status: CartItemStatus;
  /** Исходный объект item из результата поиска на фронте (произвольная структура). */
  rawItemData: unknown;
  createdAt: Date;
  updatedAt: Date;
}

const cartItemSchema = new Schema<ICartItemDocument>(
  {
    username: { type: String, required: true },
    supplier: { type: String, required: true },
    article: { type: String, required: true },
    brand: { type: String, required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, default: 1 },
    initialPrice: { type: Number, required: true },
    currentPrice: { type: Number, default: null },
    status: {
      type: String,
      required: true,
      enum: CART_ITEM_STATUS_VALUES,
      default: 'draft',
    },
    rawItemData: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

cartItemSchema.index({ username: 1 });
cartItemSchema.index({ status: 1 });

export const CartItem = mongoose.model<ICartItemDocument>('CartItem', cartItemSchema);

import mongoose, { Document, Schema } from 'mongoose';

/** Допустимые статусы позиции виртуальной корзины (жизненный цикл до оформления заказа). */
export type CartItemStatus = 'draft' | 'approved' | 'ordered' | 'cancelled';

/** Единый набор литералов статуса для сравнений и схемы Mongoose (без «магических строк» в коде). */
export const CART_ITEM_STATUS = {
  DRAFT: 'draft',
  APPROVED: 'approved',
  ORDERED: 'ordered',
  CANCELLED: 'cancelled',
} as const satisfies Record<string, CartItemStatus>;

const CART_ITEM_STATUS_VALUES: CartItemStatus[] = [
  CART_ITEM_STATUS.DRAFT,
  CART_ITEM_STATUS.APPROVED,
  CART_ITEM_STATUS.ORDERED,
  CART_ITEM_STATUS.CANCELLED,
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

/** Список корзины пользователя: фильтр по username + сортировка по дате (skip/limit). */
cartItemSchema.index({ username: 1, createdAt: -1 });
/** Админский список всех позиций с сортировкой по createdAt (пустой фильтр в запросе). */
cartItemSchema.index({ createdAt: -1, _id: -1 });
cartItemSchema.index({ status: 1 });

export const CartItem = mongoose.model<ICartItemDocument>('CartItem', cartItemSchema);

import type { CartItemStatus } from '../../models/CartItem.js';

/** Параметры пагинации списка корзины (query). */
export interface GetCartItemsPaginationInput {
  limit: number;
  skip: number;
}

/** DTO одной позиции в ответе GET /cart (явная форма вместо spread из lean-документа). */
export interface CartItemListEntryDto {
  _id: string;
  username: string;
  supplier: string;
  article: string;
  brand: string;
  name: string;
  quantity: number;
  initialPrice: number;
  currentPrice: number | null;
  status: CartItemStatus;
  rawItemData: unknown;
  createdAt: string;
  updatedAt: string;
  /**
   * Только для позиций со статусом ordered: подпись для UI из связанного Order.
   * Для остальных статусов поле отсутствует.
   */
  externalOrderId?: string | null;
}

/** Результат сервиса: страница данных + метаданные пагинации. */
export interface GetCartItemsResult {
  items: CartItemListEntryDto[];
  total: number;
  limit: number;
  skip: number;
}

/**
 * Сервис выборки списка виртуальной корзины.
 *
 * Поток: фильтр по роли → параллельно count + страница find с skip/limit →
 * для ordered-позиций — отдельный запрос Order по синтетическим id (`cart_*`) и маппинг в DTO.
 */
import type { Types } from 'mongoose';
import { USER_ROLE } from '../../constants/userRoles.js';
import {
  cartItemIdFromVirtualOrderId,
  toVirtualCartOrderId,
} from '../../constants/virtualCartOrder.js';
import { CartItem, CART_ITEM_STATUS, type CartItemStatus } from '../../models/CartItem.js';
import { Order } from '../../models/Order.js';
import { resolveExternalOrderDisplay } from '../../utils/resolveExternalOrderDisplay.js';
import type {
  CartItemListEntryDto,
  GetCartItemsPaginationInput,
  GetCartItemsResult,
} from './getCartItems.dto.js';

/** Дефолт и потолок пагинации: защита от OOM при больших выборках (в т.ч. role admin). */
export const CART_LIST_PAGINATION = {
  DEFAULT_LIMIT: 100,
  MAX_LIMIT: 500,
} as const;

type CartItemLean = {
  _id: Types.ObjectId;
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
  createdAt: Date;
  updatedAt: Date;
};

const buildCartListFilter = (username: string, role: string): Record<string, unknown> =>
  role === USER_ROLE.ADMIN ? {} : { username };

/**
 * Маппинг CartItem → связанный Order.id (виртуальная корзина) для последующей подстановки externalOrderId в DTO.
 * Инкапсулирует соглашение `cart_{cartItemId}` в одном месте сервисного слоя.
 */
const orderDocIdsForOrderedCartItems = (orderedCartItemIds: string[]): string[] =>
  orderedCartItemIds.map(toVirtualCartOrderId);

const loadExternalOrderDisplayByCartItemId = async (
  orderedCartItemIds: string[],
): Promise<Map<string, string | null>> => {
  if (orderedCartItemIds.length === 0) return new Map();

  const orderDocIds = orderDocIdsForOrderedCartItems(orderedCartItemIds);
  const orders = await Order.find({ id: { $in: orderDocIds } })
    .select({ id: 1, externalOrderId: 1, rawProviderData: 1 })
    .lean();

  return new Map(
    orders.map((o) => {
      const cartItemId = cartItemIdFromVirtualOrderId(o.id);
      return [cartItemId, resolveExternalOrderDisplay(o)] as const;
    }),
  );
};

const toCartItemListEntryDto = (
  item: CartItemLean,
  extByCartItemId: Map<string, string | null>,
): CartItemListEntryDto => {
  const idStr = String(item._id);
  const base: CartItemListEntryDto = {
    _id: idStr,
    username: item.username,
    supplier: item.supplier,
    article: item.article,
    brand: item.brand,
    name: item.name,
    quantity: item.quantity,
    initialPrice: item.initialPrice,
    currentPrice: item.currentPrice,
    status: item.status,
    rawItemData: item.rawItemData,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };

  if (item.status !== CART_ITEM_STATUS.ORDERED) {
    return base;
  }

  return {
    ...base,
    externalOrderId: extByCartItemId.get(idStr) ?? null,
  };
};

export interface GetCartItemsServiceInput {
  username: string;
  role: string;
  pagination: GetCartItemsPaginationInput;
}

/**
 * Список позиций виртуальной корзины с пагинацией и подстановкой externalOrderId для ordered.
 * admin — все позиции; иначе — только строки пользователя.
 */
export const getCartItems = async (input: GetCartItemsServiceInput): Promise<GetCartItemsResult> => {
  const { username, role, pagination } = input;
  const filter = buildCartListFilter(username, role);
  const { limit, skip } = pagination;

  const [total, items] = await Promise.all([
    CartItem.countDocuments(filter),
    CartItem.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean<CartItemLean[]>(),
  ]);

  const orderedIds = items
    .filter((i) => i.status === CART_ITEM_STATUS.ORDERED)
    .map((i) => String(i._id));

  const extByCartItemId = await loadExternalOrderDisplayByCartItemId(orderedIds);

  const dtos = items.map((item) => toCartItemListEntryDto(item, extByCartItemId));

  return {
    items: dtos,
    total,
    limit,
    skip,
  };
};

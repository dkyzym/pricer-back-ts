import { Logger } from 'winston';
import { CartItem, ICartItemDocument } from '../../models/CartItem.js';
import { actualizeAbcpCart } from '../platforms/abcp/parser/actualizeAbcpCart.js';
import { supplierHandlers } from '../../sockets/handlers/supplierHandlers.js';
import {
  ItemToParallelSearch,
  SearchResultsParsed,
} from '../../types/search.types.js';
import { SupplierName } from '../../types/common.types.js';

// =========================================================================
//  Типы отчёта
// =========================================================================

/** Статус актуализации одной позиции. */
export type ActualizeStatus =
  | 'ok'
  | 'price_changed'
  | 'not_found'
  | 'error';

/** Строка отчёта — старое состояние vs. новое. */
export interface ActualizeReportItem {
  cartItemId: string;
  article: string;
  brand: string;
  supplier: string;
  name: string;
  status: ActualizeStatus;
  initialPrice: number;
  currentPrice: number | null;
  priceDiff: number | null;
  availableQuantity: number | string | null;
  requestedQuantity: number;
  isAvailable: boolean;
  error?: string;
}

// =========================================================================
//  Вспомогательные функции
// =========================================================================

/** Поставщики с актуализацией по HTML `/cart` (ABCP), а не по сокетному поиску. */
const ABCP_HTML_CART_ACTUALIZE_SUPPLIERS = new Set(['mikano', 'autoImpulse']);

/** Группирует документы по supplier для пакетных запросов. */
const groupBySupplier = (
  items: ICartItemDocument[],
): Map<string, ICartItemDocument[]> => {
  const groups = new Map<string, ICartItemDocument[]>();

  for (const item of items) {
    const list = groups.get(item.supplier) ?? [];
    list.push(item);
    groups.set(item.supplier, list);
  }

  return groups;
};

/** Восстанавливает `ItemToParallelSearch` из CartItem для повторного вызова хендлера. */
const reconstructSearchItem = (
  cartItem: ICartItemDocument,
): ItemToParallelSearch => ({
  id: cartItem._id.toString(),
  brand: cartItem.brand,
  article: cartItem.article,
  description: cartItem.name,
  dataUrl: '',
});

/**
 * Парсит `availability` (число или строка вроде "10", "10+", ">100")
 * в числовое значение. Возвращает `null`, если разбор невозможен.
 */
const parseAvailability = (value: number | string): number | null => {
  if (typeof value === 'number') return value;
  const parsed = parseInt(value, 10);
  if (!isNaN(parsed)) return parsed;
  const digits = value.replace(/\D/g, '');
  return digits ? parseInt(digits, 10) : null;
};

/**
 * Ищет точное совпадение в результатах поиска.
 *
 * Из `rawItemData` используются `innerId` и `warehouse_id`. Приведение к строке
 * страхует от несоответствия типов (Number/String) между БД и ответом API.
 * сохранён `warehouse_id`, кандидат обязан иметь тот же `result.warehouse_id`.
 *
 * Порядок оценки:
 *   1. точное совпадение `innerId`;
 *   2. однозначное совпадение по `warehouse_id` (ровно одна строка в пуле);
 *   3. совпадение `warehouse` + `deadline` (при нескольких строках с тем же названием склада);
 *   4. совпадение по имени склада `warehouse`.
 *
 * Не используем временные токены (itemKey, KEYZAK и пр.) — они обновляются при каждом поиске.
 */
const findExactMatch = (
  results: SearchResultsParsed[],
  cartItem: ICartItemDocument,
): SearchResultsParsed | undefined => {
  if (!Array.isArray(results) || results.length === 0) return undefined;

  const raw = cartItem.rawItemData as Partial<SearchResultsParsed> | null;
  if (!raw) return results[0];

  const innerId = raw.innerId;
  const rawWarehouseId = raw.warehouse_id;
  const warehouseIdRequired =
    rawWarehouseId !== undefined &&
    rawWarehouseId !== null &&
    String(rawWarehouseId).trim() !== '';

  let pool = results;

  if (warehouseIdRequired) {
    pool = results.filter((r) => String(r.warehouse_id) === String(rawWarehouseId));
    if (!pool.length) return undefined;
  }

  if (
    innerId !== undefined &&
    innerId !== null &&
    String(innerId).trim() !== ''
  ) {
    const byInnerId = pool.find((r) => String(r.innerId) === String(innerId));
    if (byInnerId) return byInnerId;
  }

  if (warehouseIdRequired) {
    const byWarehouseId = pool.filter(
      (r) => String(r.warehouse_id) === String(rawWarehouseId),
    );
    if (byWarehouseId.length === 1) return byWarehouseId[0];
    pool = byWarehouseId;
  }

  if (raw.warehouse) {
    const byWarehouse = pool.filter((r) => r.warehouse === raw.warehouse);
    if (byWarehouse.length === 1) return byWarehouse[0];

    if (byWarehouse.length > 1 && raw.deadline != null) {
      const byDeadline = byWarehouse.find(
        (r) => r.deadline === raw.deadline,
      );
      if (byDeadline) return byDeadline;
    }

    if (byWarehouse.length > 0) return byWarehouse[0];
  }

  return undefined;
};

/** Формирует строку отчёта со статусом `error`. */
const buildErrorReport = (
  cartItem: ICartItemDocument,
  error: string,
): ActualizeReportItem => ({
  cartItemId: cartItem._id.toString(),
  article: cartItem.article,
  brand: cartItem.brand,
  supplier: cartItem.supplier,
  name: cartItem.name,
  status: 'error',
  initialPrice: cartItem.initialPrice,
  currentPrice: null,
  priceDiff: null,
  availableQuantity: null,
  requestedQuantity: cartItem.quantity,
  isAvailable: false,
  error,
});

// =========================================================================
//  Основная функция
// =========================================================================

/**
 * Актуализация позиций виртуальной корзины. *
 * Поток данных:
 *   1. Загрузка CartItem-документов по ID.
 *   2. Группировка по supplier → дедупликация поисковых запросов по article+brand.
 *   3. Параллельный вызов `supplierHandlers[supplier]` для каждого уникального артикула.
 *   4. Сопоставление результатов с позициями корзины (`findExactMatch`).
 *   5. Перезапись `rawItemData` (обновление временных токенов) и `currentPrice`.
 *   6. Batch-save обновлённых документов.
 *   7. Формирование отчёта для фронтенда.
 */
export const actualizeCartItems = async (
  cartItemIds: string[],
  userLogger: Logger,
): Promise<ActualizeReportItem[]> => {
  const cartItems = await CartItem.find({ _id: { $in: cartItemIds } });

  if (!cartItems.length) {
    userLogger.warn('[Actualize] Не найдено позиций для актуализации.');
    return [];
  }

  const groups = groupBySupplier(cartItems);
  const reportMap = new Map<string, ActualizeReportItem>();

  const supplierTasks = Array.from(groups.entries()).map(
    async ([supplier, items]) => {
      if (ABCP_HTML_CART_ACTUALIZE_SUPPLIERS.has(supplier)) {
        try {
          const reports = await actualizeAbcpCart(supplier, items, userLogger);
          for (const r of reports) {
            reportMap.set(r.cartItemId, r);
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Критическая ошибка парсера ABCP';
          userLogger.error(`[Actualize] Ошибка у ${supplier}: ${msg}`);
          for (const item of items) {
            reportMap.set(item._id.toString(), buildErrorReport(item, msg));
          }
        }
        return;
      }

      const handler = supplierHandlers[supplier];

      if (!handler) {
        for (const item of items) {
          reportMap.set(
            item._id.toString(),
            buildErrorReport(
              item,
              `Обработчик для поставщика «${supplier}» не найден.`,
            ),
          );
        }
        return;
      }

      /**
       * Дедупликация: один запрос на уникальную пару article+brand,
       * даже если в корзине несколько строк (разные склады).
       */
      const uniqueSearches = new Map<
        string,
        { searchItem: ItemToParallelSearch; cartItems: ICartItemDocument[] }
      >();

      for (const item of items) {
        const key = `${item.article.toLowerCase()}|${item.brand.toLowerCase()}`;
        const existing = uniqueSearches.get(key);
        if (existing) {
          existing.cartItems.push(item);
        } else {
          uniqueSearches.set(key, {
            searchItem: reconstructSearchItem(item),
            cartItems: [item],
          });
        }
      }

      const searchTasks = Array.from(uniqueSearches.values()).map(
        async ({ searchItem, cartItems: related }) => {
          try {
            let results: SearchResultsParsed[] = [];
            let searchError: string | undefined;

            try {
              userLogger.info(
                `[Actualize] ${searchItem.article} (${searchItem.brand}) → ${supplier}`,
              );
              results = await handler(
                { item: searchItem, supplier: supplier as SupplierName },
                userLogger,
              );
              if (!Array.isArray(results)) results = [];
            } catch (err: unknown) {
              searchError =
                err instanceof Error
                  ? err.message
                  : 'Неизвестная ошибка при поиске.';
              userLogger.error(
                `[Actualize] Ошибка у ${supplier}: ${searchError}`,
              );
            }

            for (const cartItem of related) {
              const itemId = cartItem._id.toString();

              if (searchError) {
                reportMap.set(itemId, buildErrorReport(cartItem, searchError));
                continue;
              }

              const match = findExactMatch(results, cartItem);

              if (!match) {
                reportMap.set(itemId, {
                  cartItemId: itemId,
                  article: cartItem.article,
                  brand: cartItem.brand,
                  supplier: cartItem.supplier,
                  name: cartItem.name,
                  status: 'not_found',
                  initialPrice: cartItem.initialPrice,
                  currentPrice: null,
                  priceDiff: null,
                  availableQuantity: null,
                  requestedQuantity: cartItem.quantity,
                  isAvailable: false,
                });
                continue;
              }

              const newPrice = match.price;
              const priceChanged = newPrice !== cartItem.initialPrice;

              const availNum = parseAvailability(match.availability);
              const isAvailable =
                availNum !== null ? availNum >= cartItem.quantity : false;

              cartItem.rawItemData = match;
              cartItem.currentPrice = newPrice;

              reportMap.set(itemId, {
                cartItemId: itemId,
                article: cartItem.article,
                brand: cartItem.brand,
                supplier: cartItem.supplier,
                name: cartItem.name,
                status: priceChanged ? 'price_changed' : 'ok',
                initialPrice: cartItem.initialPrice,
                currentPrice: newPrice,
                priceDiff: +(newPrice - cartItem.initialPrice).toFixed(2),
                availableQuantity: match.availability,
                requestedQuantity: cartItem.quantity,
                isAvailable,
              });
            }
          } catch (fatalError) {
            const msg = fatalError instanceof Error ? fatalError.message : 'Фатальная ошибка обработки результатов';
            userLogger.error(`[Actualize] Сбой сопоставления у ${supplier}: ${msg}`);
            for (const cartItem of related) {
              reportMap.set(cartItem._id.toString(), buildErrorReport(cartItem, msg));
            }
          }
        },
      );

      await Promise.allSettled(searchTasks);
    },
  );

  await Promise.allSettled(supplierTasks);

  const savePromises = cartItems
    .filter((item) => {
      const report = reportMap.get(item._id.toString());
      return report?.status === 'ok' || report?.status === 'price_changed';
    })
    .map((item) => item.save());

  await Promise.allSettled(savePromises);

  return cartItemIds
    .map((id) => reportMap.get(id))
    .filter((r): r is ActualizeReportItem => r !== undefined);
};
import cron from 'node-cron';
import mongoose from 'mongoose';
import axios from 'axios';
import { logger } from '../config/logger/index.js';
import { syncOrdersBatch } from '../services/db/orderSyncRepository.js';
import { orderHandlers } from '../services/orders/orderHandlers.js';
import { sendRefusedOrdersNotification } from '../services/telegram/notifyRefusedOrders.js';
import { Order } from '../models/Order.js';
import type { UnifiedOrderItem } from '../services/orders/orders.types.js';

const ACTIVE_STATUSES = ['pending', 'work', 'shipping'] as const;
const BUFFER_DAYS = 2;
const DEFAULT_LOOKBACK_DAYS = 3;
const MAX_LOOKBACK_DAYS = 45;
const EMPTY_DB_LOOKBACK_DAYS = 90;

/** Cron: at :00 only in hours 0-7 and 19-23 (no runs 8:00-18:59 server time) */
const SCHEDULE = '0 0-7,19-23 * * *';
/** Max random delay before cycle start (ms), to spread load and avoid thundering herd */
const MAX_RANDOM_DELAY_MS = 5 * 60 * 1000;
/** Таймаут на один handler поставщика — защита от зависших HTTP/DB операций */
const SUPPLIER_HANDLER_TIMEOUT_MS = 3 * 60 * 1000;
/** Порог устаревания цикла: если runStartedAt старше этого — считаем цикл зависшим */
const STALE_RUN_THRESHOLD_MS = 30 * 60 * 1000;

function subtractDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

/**
 * Гонка promise vs таймер: если promise не резолвится за ms — reject с ошибкой.
 * Не отменяет саму операцию (нет AbortController), но разблокирует ожидающий цикл.
 */
const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`[timeout] ${label}: не завершился за ${ms}ms`)),
      ms
    );
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });

async function computeTargetSyncDate(supplier: string): Promise<Date> {
  const now = new Date();

  const anyOrder = await Order.findOne({ supplier }).select('_id').lean();

  if (!anyOrder) {
    return subtractDays(now, EMPTY_DB_LOOKBACK_DAYS);
  }

  const oldestActiveOrder = await Order.findOne({
    supplier,
    status: { $in: ACTIVE_STATUSES },
  })
    .sort({ providerCreatedAt: 1 })
    .select('providerCreatedAt')
    .lean();

  let targetSyncDate: Date;

  if (oldestActiveOrder?.providerCreatedAt) {
    targetSyncDate = subtractDays(
      new Date(oldestActiveOrder.providerCreatedAt),
      BUFFER_DAYS
    );
  } else {
    targetSyncDate = subtractDays(now, DEFAULT_LOOKBACK_DAYS);
  }

  const hardLimit = subtractDays(now, MAX_LOOKBACK_DAYS);
  if (targetSyncDate < hardLimit) {
    targetSyncDate = hardLimit;
  }

  return targetSyncDate;
}

export function startOrderSyncWorker(): void {
  /** null — свободен; number — Date.now() старта текущего цикла */
  let runStartedAt: number | null = null;

  logger.info('[orderSyncWorker] Worker started', {
    schedule: SCHEDULE,
    maxRandomDelayMs: MAX_RANDOM_DELAY_MS,
  });

  const runSyncCycle = async () => {
    if (runStartedAt !== null) {
      const elapsedMs = Date.now() - runStartedAt;

      if (elapsedMs < STALE_RUN_THRESHOLD_MS) {
        logger.warn(
          '[orderSyncWorker] Skip cycle: previous run is still in progress',
          { elapsedMs }
        );
        return;
      }

      logger.warn(
        '[orderSyncWorker] Previous run stale — force-resetting mutex',
        { elapsedMs, staleThresholdMs: STALE_RUN_THRESHOLD_MS }
      );
    }

    runStartedAt = Date.now();

    try {
      if (mongoose.connection.readyState !== 1) {
        logger.warn('[orderSyncWorker] Skip cycle: MongoDB is not connected', {
          readyState: mongoose.connection.readyState,
        });
        return;
      }

      const delayMs = Math.floor(Math.random() * MAX_RANDOM_DELAY_MS);
      if (delayMs > 0) {
        logger.debug('[orderSyncWorker] Random delay before cycle', { delayMs });
        await new Promise((r) => setTimeout(r, delayMs));
      }

      if (mongoose.connection.readyState !== 1) {
        logger.warn('[orderSyncWorker] Skip cycle: MongoDB disconnected during delay', {
          readyState: mongoose.connection.readyState,
        });
        return;
      }

      const cycleStartedAt = Date.now();
      const suppliers = Object.keys(orderHandlers);

      logger.info('[orderSyncWorker] Cycle started', {
        suppliersCount: suppliers.length,
        suppliers,
      });

      for (const [supplier, handler] of Object.entries(orderHandlers)) {
        const supplierStartedAt = Date.now();

        logger.info('[orderSyncWorker] Supplier sync started', { supplier });

        try {
          const targetSyncDate = await computeTargetSyncDate(supplier);

          logger.info('[orderSyncWorker] Computed targetSyncDate', {
            supplier,
            targetSyncDate: targetSyncDate.toISOString(),
          });

          const orders: UnifiedOrderItem[] = await withTimeout(
            handler(logger, targetSyncDate),
            SUPPLIER_HANDLER_TIMEOUT_MS,
            supplier
          );

          logger.info('[orderSyncWorker] Supplier fetch success', {
            supplier,
            ordersCount: orders.length,
          });

          await syncOrdersBatch(orders);

          logger.info('[orderSyncWorker] Supplier sync success', {
            supplier,
            ordersCount: orders.length,
            durationMs: Date.now() - supplierStartedAt,
          });
        } catch (error) {
          let safeError: any = { message: error instanceof Error ? error.message : String(error) };
          if (axios.isAxiosError(error)) {
            safeError = {
              message: error.message,
              code: error.code,
              status: error.response?.status,
            };
          } else if (error instanceof Error) {
            safeError.stack = error.stack;
          }
          logger.error('[orderSyncWorker] Supplier sync error', {
            supplier,
            error: safeError,
          });
        }
      }

      await sendRefusedOrdersNotification().catch((err) => {
        logger.warn('[orderSyncWorker] Telegram уведомление об отказах не отправлено', {
          error: err instanceof Error ? err.message : String(err),
        });
      });

      logger.info('[orderSyncWorker] Cycle completed', {
        durationMs: Date.now() - cycleStartedAt,
      });
    } catch (error) {
      logger.error('[orderSyncWorker] Unexpected cycle error', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    } finally {
      runStartedAt = null;
    }
  };

  runSyncCycle().catch((err) =>
    logger.error('[orderSyncWorker] Initial run error', { error: err })
  );

  cron.schedule(SCHEDULE, runSyncCycle);
}

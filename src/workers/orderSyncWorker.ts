import axios from 'axios';
import mongoose from 'mongoose';
import cron from 'node-cron';
import { logger } from '../config/logger/index.js';
import { Order } from '../models/Order.js';
import { syncOrdersBatch } from '../services/db/orderSyncRepository.js';
import { orderHandlers } from '../services/orders/orderHandlers.js';
import type { UnifiedOrderItem } from '../services/orders/orders.types.js';
import { sendRefusedOrdersNotification } from '../services/telegram/notifyRefusedOrders.js';

// setInterval(() => {
//   logger.debug('[PULSE] Event loop is alive, memory:', process.memoryUsage().rss / 1024 / 1024, 'MB');
// }, 60000); // Раз в минуту

setInterval(() => {
  logger.debug(`[PULSE] Event loop is alive, memory: ${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB`);
}, 60000);

const ACTIVE_STATUSES = ['pending', 'work', 'shipping'] as const;
const BUFFER_DAYS = 2;
const DEFAULT_LOOKBACK_DAYS = 3;
const MAX_LOOKBACK_DAYS = 45;
const EMPTY_DB_LOOKBACK_DAYS = 90;


/** Cron: at :00 only in hours 0-7 and 19-23 (no runs 8:00-18:59 server time) */
const SCHEDULE = '0 0-7,19-23 * * *';
// const SCHEDULE = '*/60 * * * *';
/** Max random delay before cycle start (ms), to spread load and avoid thundering herd */
const MAX_RANDOM_DELAY_MS = 5 * 60 * 1000;
/** Таймаут на один handler поставщика — при превышении AbortController.abort() прерывает HTTP-сокеты */
const SUPPLIER_HANDLER_TIMEOUT_MS = 3 * 60 * 1000;
/** Порог устаревания цикла: если runStartedAt старше этого — abort() старого цикла и запуск нового */
const STALE_RUN_THRESHOLD_MS = 30 * 60 * 1000;

const subtractDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
};

/**
 * Задержка с поддержкой отмены через AbortSignal.
 * При вызове abort() на связанном контроллере — промис реджектится,
 * таймер очищается, Event Loop не блокируется.
 */
const abortableDelay = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });

/**
 * Axios при abort() выбрасывает CanceledError (axios.isCancel),
 * AbortController — DOMException с name 'AbortError'.
 * Оба случая — штатная отмена, а не ошибка бизнес-логики.
 */
const isAbortError = (err: unknown): boolean => {
  if (axios.isCancel(err)) return true;
  if (err instanceof Error) return err.name === 'AbortError';
  return false;
};

const computeTargetSyncDate = async (supplier: string): Promise<Date> => {
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
};

export const startOrderSyncWorker = (): void => {
  /**
   * Мьютекс цикла через AbortController: позволяет не только отслеживать,
   * запущен ли цикл, но и физически прервать все его in-flight HTTP-запросы
   * через signal propagation (cycle → supplier → axios).
   * null — цикл свободен.
   */
  let activeCycleController: AbortController | null = null;
  let runStartedAt: number | null = null;

  logger.info('[orderSyncWorker] Worker started', {
    schedule: SCHEDULE,
    maxRandomDelayMs: MAX_RANDOM_DELAY_MS,
  });

  const runSyncCycle = async () => {
    /* ───── Мьютекс: проверка и abort stale-цикла ───── */
    if (runStartedAt !== null) {
      const elapsedMs = Date.now() - runStartedAt;

      if (elapsedMs < STALE_RUN_THRESHOLD_MS) {
        logger.warn(
          '[orderSyncWorker] Skip cycle: previous run is still in progress',
          { elapsedMs }
        );
        return;
      }

      /**
       * Stale-цикл: abort() каскадно прерывает все HTTP-сокеты старого цикла
       * через цепочку AbortController (cycle → supplier → axios).
       * Промисы старого цикла реджектятся, его finally-блок сработает
       * и увидит, что activeCycleController уже не его — не тронет новое состояние.
       */
      logger.warn(
        '[orderSyncWorker] Previous run stale — aborting via AbortController',
        { elapsedMs, staleThresholdMs: STALE_RUN_THRESHOLD_MS }
      );
      activeCycleController?.abort();
    }

    /* ───── Инициализация нового цикла ───── */
    const cycleController = new AbortController();
    activeCycleController = cycleController;
    runStartedAt = Date.now();
    const { signal: cycleSignal } = cycleController;

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
        await abortableDelay(delayMs, cycleSignal);
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
        if (cycleSignal.aborted) break;

        const supplierStartedAt = Date.now();
        logger.info('[orderSyncWorker] Supplier sync started', { supplier });

        /**
         * Per-supplier AbortController: автоматический abort() через SUPPLIER_HANDLER_TIMEOUT_MS.
         * Связан с родительским cycleController — если весь цикл прерывается (stale),
         * supplier-контроллер тоже отменяется каскадно.
         */
        const supplierController = new AbortController();
        const timeoutId = setTimeout(
          () => supplierController.abort(),
          SUPPLIER_HANDLER_TIMEOUT_MS
        );
        const onCycleAbort = () => supplierController.abort();
        cycleSignal.addEventListener('abort', onCycleAbort, { once: true });

        try {
          const targetSyncDate = await computeTargetSyncDate(supplier);

          logger.info('[orderSyncWorker] Computed targetSyncDate', {
            supplier,
            targetSyncDate: targetSyncDate.toISOString(),
          });

          const orders: UnifiedOrderItem[] = await handler(
            logger,
            targetSyncDate,
            supplierController.signal
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
          if (isAbortError(error)) {
            logger.warn('[orderSyncWorker] Supplier sync aborted', {
              supplier,
              reason: cycleSignal.aborted ? 'cycle_aborted' : 'supplier_timeout',
              durationMs: Date.now() - supplierStartedAt,
            });
          } else {
            let safeError: Record<string, unknown> = {
              message: error instanceof Error ? error.message : String(error),
            };
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
        } finally {
          clearTimeout(timeoutId);
          cycleSignal.removeEventListener('abort', onCycleAbort);
        }
      }

      if (!cycleSignal.aborted) {
        await sendRefusedOrdersNotification().catch((err) => {
          logger.warn('[orderSyncWorker] Telegram уведомление об отказах не отправлено', {
            error: err instanceof Error ? err.message : String(err),
          });
        });
      }

      logger.info('[orderSyncWorker] Cycle completed', {
        durationMs: Date.now() - cycleStartedAt,
      });
    } catch (error) {
      if (isAbortError(error)) {
        logger.warn('[orderSyncWorker] Cycle aborted (stale run detected by next cycle)');
      } else {
        logger.error('[orderSyncWorker] Unexpected cycle error', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
      }
    } finally {
      /**
       * Очистка мьютекса только если МЫ всё ещё являемся активным циклом.
       * Если следующий цикл уже перехватил activeCycleController (stale-abort),
       * мы — "старый" цикл и не должны затирать его состояние.
       */
      if (activeCycleController === cycleController) {
        activeCycleController = null;
        runStartedAt = null;
      }
    }
  };

  runSyncCycle().catch((err) =>
    logger.error('[orderSyncWorker] Initial run error', { error: err })
  );

  cron.schedule(SCHEDULE, runSyncCycle);
};

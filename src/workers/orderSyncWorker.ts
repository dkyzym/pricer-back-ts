import cron from 'node-cron';
import mongoose from 'mongoose';
import axios from 'axios';
import { logger } from '../config/logger/index.js';
import { syncOrdersBatch } from '../services/db/orderSyncRepository.js';
import { orderHandlers } from '../services/orders/orderHandlers.js';
import { Order } from '../models/Order.js';
import type { UnifiedOrderItem } from '../services/orders/orders.types.js';

const ACTIVE_STATUSES = ['pending', 'work', 'shipping'] as const;
const BUFFER_DAYS = 2;
const DEFAULT_LOOKBACK_DAYS = 3;
const MAX_LOOKBACK_DAYS = 45;
const EMPTY_DB_LOOKBACK_DAYS = 90;

function subtractDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

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
  let isRunning = false;
  const schedule = '0 * * * *'; // every 60 minutes

  logger.info('[orderSyncWorker] Worker started', { schedule });

  const runSyncCycle = async () => {
    if (isRunning) {
      logger.warn(
        '[orderSyncWorker] Skip cycle: previous run is still in progress'
      );
      return;
    }

    if (mongoose.connection.readyState !== 1) {
      logger.warn('[orderSyncWorker] Skip cycle: MongoDB is not connected', {
        readyState: mongoose.connection.readyState,
      });
      return;
    }

    isRunning = true;
    const cycleStartedAt = Date.now();
    const suppliers = Object.keys(orderHandlers);

    logger.info('[orderSyncWorker] Cycle started', {
      suppliersCount: suppliers.length,
      suppliers,
    });

    try {
      for (const [supplier, handler] of Object.entries(orderHandlers)) {
        const supplierStartedAt = Date.now();

        logger.info('[orderSyncWorker] Supplier sync started', { supplier });

        try {
          const targetSyncDate = await computeTargetSyncDate(supplier);

          logger.info('[orderSyncWorker] Computed targetSyncDate', {
            supplier,
            targetSyncDate: targetSyncDate.toISOString(),
          });

          const orders: UnifiedOrderItem[] = await handler(logger, targetSyncDate);

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

      logger.info('[orderSyncWorker] Cycle completed', {
        durationMs: Date.now() - cycleStartedAt,
      });
    } catch (error) {
      logger.error('[orderSyncWorker] Unexpected cycle error', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    } finally {
      isRunning = false;
    }
  };

  runSyncCycle().catch((err) =>
    logger.error('[orderSyncWorker] Initial run error', { error: err })
  );

  cron.schedule(schedule, runSyncCycle);
}

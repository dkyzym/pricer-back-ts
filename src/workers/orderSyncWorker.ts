import cron from 'node-cron';
import mongoose from 'mongoose';
import axios from 'axios';
import { logger } from '../config/logger/index.js';
import { syncOrdersBatch } from '../services/db/orderSyncRepository.js';
import { orderHandlers } from '../services/orders/orderHandlers.js';
import type { UnifiedOrderItem } from '../services/orders/orders.types.js';

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
          const orders: UnifiedOrderItem[] = await handler(logger);

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

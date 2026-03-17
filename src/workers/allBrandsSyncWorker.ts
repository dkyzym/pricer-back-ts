import cron from 'node-cron';
import { logger } from '../config/logger/index.js';
import { syncAllBrandsCache } from '../services/suppliers/brands/allBrandsCache.js';

const SCHEDULE = '0 4 1 * *';

export function startAllBrandsSyncWorker(): void {
  let isRunning = false;

  logger.info('[allBrandsSyncWorker] Worker started', {
    schedule: SCHEDULE,
    refreshIntervalMonths: 6,
  });

  const runSyncCycle = async () => {
    if (isRunning) {
      logger.warn('[allBrandsSyncWorker] Skip cycle: previous run is still in progress');
      return;
    }

    isRunning = true;

    try {
      const result = await syncAllBrandsCache();

      if (result.updated) {
        logger.info('[allBrandsSyncWorker] Cache refreshed', {
          reason: result.reason,
          brandsCount: result.brandsCount,
          path: result.path,
          updatedAt: result.updatedAt?.toISOString(),
          refreshAfter: result.refreshAfter?.toISOString(),
        });
        return;
      }

      logger.debug('[allBrandsSyncWorker] Cache is fresh, skipping refresh', {
        path: result.path,
        updatedAt: result.updatedAt?.toISOString(),
        refreshAfter: result.refreshAfter?.toISOString(),
      });
    } catch (error) {
      logger.error('[allBrandsSyncWorker] Sync error', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    } finally {
      isRunning = false;
    }
  };

  runSyncCycle().catch((error) =>
    logger.error('[allBrandsSyncWorker] Initial run error', {
      error: error instanceof Error ? error.message : String(error),
    })
  );

  cron.schedule(SCHEDULE, runSyncCycle);
}

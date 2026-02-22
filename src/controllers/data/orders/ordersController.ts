import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { logger } from '../../../config/logger/index.js';
import { orderHandlers } from '../../../services/orders/orderHandlers.js';
import { UnifiedOrderItem } from '../../../services/orders/orders.types.js';

export const getOrders = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const requestId = randomUUID();

  const requestLogger = logger.child({
    requestId,
    module: 'OrdersController',
    user: (req as any).user?.uid || 'anonymous',
  });

  try {
    requestLogger.info('Received request for orders');

    // 1. Получаем и фильтруем список поставщиков
    const suppliersQuery = req.query.suppliers as string;
    const availableSuppliers = Object.keys(orderHandlers);

    const targets = suppliersQuery
      ? suppliersQuery.split(',').filter((key) => {
          const exists = availableSuppliers.includes(key);
          if (!exists) {
            requestLogger.warn(`Unknown supplier requested: ${key}`);
          }
          return exists;
        })
      : availableSuppliers;

    if (targets.length === 0) {
      return res.status(400).json({ error: 'No valid suppliers requested' });
    }

    requestLogger.debug('Targets resolved', { targets });

    // 2. Формируем промисы-обертки, чтобы точно знать, кто упал, а кто нет
    const promises = targets.map(async (supplierName) => {
      try {
        const data = await orderHandlers[supplierName](requestLogger);
        return { supplierName, status: 'fulfilled' as const, data };
      } catch (error) {
        return { supplierName, status: 'rejected' as const, error };
      }
    });

    // 3. Запускаем параллельно
    const results = await Promise.all(promises);

    // 4. Анализ результатов
    const flatOrders: UnifiedOrderItem[] = [];
    const failedSuppliers: { name: string; reason: string }[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled') {
        flatOrders.push(...result.data);
      } else {
        const errorMessage =
          result.error instanceof Error
            ? result.error.message
            : String(result.error);
        failedSuppliers.push({
          name: result.supplierName,
          reason: errorMessage,
        });
        requestLogger.warn(`Failed to fetch from ${result.supplierName}`, {
          reason: errorMessage,
        });
      }
    }

    requestLogger.info('Orders aggregation finished', {
      totalOrders: flatOrders.length,
      failedCount: failedSuppliers.length,
      successCount: targets.length - failedSuppliers.length,
    });

    // 5. Отправляем структурированный ответ
    res.json({
      data: flatOrders,
      meta: {
        totalOrders: flatOrders.length,
        successCount: targets.length - failedSuppliers.length,
        failedSuppliers,
      },
    });
  } catch (e) {
    requestLogger.error('Critical error in orders controller', { error: e });
    next(e);
  }
};

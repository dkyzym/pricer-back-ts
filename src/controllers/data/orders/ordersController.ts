import { randomUUID } from 'crypto'; // Нативный модуль Node.js
import { NextFunction, Request, Response } from 'express';
import { logger } from '../../../config/logger/index.js';
import { orderHandlers } from '../../../services/orders/orderHandlers.js';
import { UnifiedOrderItem } from '../../../services/orders/orders.types.js';
export const getOrders = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Генерируем ID запроса для трассировки (tracing)
  const requestId = randomUUID();

  // Создаем дочерний логгер с контекстом
  const requestLogger = logger.child({
    requestId,
    module: 'OrdersController',
    user: (req as any).user?.uid || 'anonymous', // Если есть авторизация
  });

  try {
    requestLogger.info('Received request for orders');

    // 1. Получаем список поставщиков
    const suppliersQuery = req.query.suppliers as string;
    const targets = suppliersQuery
      ? suppliersQuery.split(',')
      : Object.keys(orderHandlers);

    requestLogger.debug('Targets resolved', { targets });

    // 2. Формируем промисы, внедряя логгер в каждый хендлер
    const promises = targets
      .filter((key) => {
        const handlerExists = !!orderHandlers[key];
        if (!handlerExists) {
          requestLogger.warn(`Unknown supplier requested: ${key}`);
        }
        return handlerExists;
      })
      .map((key) => orderHandlers[key](requestLogger)); // <-- ВНЕДРЕНИЕ ЗАВИСИМОСТИ

    // 3. Запускаем параллельно
    const results = await Promise.allSettled(promises);

    // 4. Анализ результатов
    const flatOrders: UnifiedOrderItem[] = [];
    const failedSuppliers: string[] = [];

    results.forEach((r, index) => {
      // Так как targets были отфильтрованы, индекс совпадает (почти, но лучше мапить аккуратнее если фильтр сложный)
      // В данном простом случае targets[index] соответствует промису, так как filter был до map
      const supplierName = targets.filter((k) => !!orderHandlers[k])[index];

      if (r.status === 'fulfilled') {
        flatOrders.push(...r.value);
      } else {
        failedSuppliers.push(supplierName);
        // Детальную ошибку уже залогировал сам хендлер (createAbcpOrderHandler/createAutosputnikHandler),
        // но здесь можно добавить summary.
        requestLogger.warn(`Failed to fetch from ${supplierName}`, {
          reason: r.reason,
        });
      }
    });

    requestLogger.info('Orders aggregation finished', {
      totalOrders: flatOrders.length,
      failedSuppliers,
      successCount: targets.length - failedSuppliers.length,
    });

    res.json(flatOrders);
  } catch (e) {
    requestLogger.error('Critical error in orders controller', { error: e });
    next(e);
  }
};

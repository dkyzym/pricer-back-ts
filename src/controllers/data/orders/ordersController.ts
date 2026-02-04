import { NextFunction, Request, Response } from 'express';
import { orderHandlers } from '../../../services/orders/orderHandlers.js';
import { UnifiedOrderItem } from '../../../services/orders/orders.types.js';

export const getOrders = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // 1. Получаем список поставщиков от фронта (?suppliers=ug,patriot)
    const suppliersQuery = req.query.suppliers as string;

    // Если параметр передан, разбиваем строку. Если нет — берем всех доступных из хендлеров.
    const targets = suppliersQuery
      ? suppliersQuery.split(',')
      : Object.keys(orderHandlers);

    // 2. Формируем массив промисов только для существующих хендлеров
    const promises = targets
      .filter((key) => {
        const handlerExists = !!orderHandlers[key];
        if (!handlerExists) {
          console.warn(
            `[Orders] Warning: Requested unknown supplier handler '${key}'`
          );
        }
        return handlerExists;
      })
      .map((key) => orderHandlers[key]());

    // 3. Запускаем параллельно (Promise.allSettled не падает, если один поставщик отвалился)
    const results = await Promise.allSettled(promises);

    // 4. Собираем результаты
    // Берем только fulfilled (успешные) и объединяем массивы через flatMap
    const flatOrders: UnifiedOrderItem[] = results.flatMap((r) =>
      r.status === 'fulfilled' ? r.value : []
    );

    // (Опционально) Можно залогировать ошибки rejected промисов, чтобы знать, кто упал
    results.forEach((r, index) => {
      if (r.status === 'rejected') {
        console.error(
          `[Orders] Error fetching from one of the suppliers:`,
          r.reason
        );
      }
    });

    // 5. Отдаем чистый JSON на фронт
    res.json(flatOrders);
  } catch (e) {
    next(e);
  }
};

import { Request, Response } from 'express';
import { Order, IOrderDocument } from '../../../models/Order.js';

export const getOrders = async (req: Request, res: Response) => {
  const suppliers = req.query.suppliers as string | undefined;
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 100;
  const fromDate = req.query.fromDate as string | undefined;
  const toDate = req.query.toDate as string | undefined;

  const query: Record<string, unknown> = {};

  if (suppliers) {
    query.supplier = { $in: suppliers.split(',') };
  }

  if (fromDate || toDate) {
    const dateFilter: Record<string, Date> = {};

    if (fromDate) {
      const from = new Date(fromDate);
      if (!isNaN(from.getTime())) {
        dateFilter.$gte = from;
      }
    }

    if (toDate) {
      const to = new Date(toDate);
      if (!isNaN(to.getTime())) {
        dateFilter.$lte = to;
      }
    }

    if (Object.keys(dateFilter).length > 0) {
      query.providerCreatedAt = dateFilter;
    }
  }

  const [totalOrders, orders] = await Promise.all([
    Order.countDocuments(query),
    Order.find(query)
      .sort({ providerCreatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
  ]);

  res.json({
    data: orders,
    meta: {
      totalOrders,
      page,
      limit,
      totalPages: Math.ceil(totalOrders / limit),
    },
  });
};

import { Request, Response } from 'express';
import { Order, IOrderDocument } from '../../../models/Order.js';
import { cleanArticleString } from '../../../utils/data/brand/cleanArticleString.js';
import { expandBrandToken } from '../../../utils/data/brand/expandBrandToken.js';
import { SupplierName } from '../../../types/common.types.js';

const supplierNameMap: Record<SupplierName, string> = {
  profit: 'Профит',
  autosputnik: 'Автоспутник',
  autosputnik_bn: 'Автоспутн.-б/н',
  autoImpulse: 'Автоимпульс',
  ug: 'ЮГ',
  ug_f: 'ЮГ-быстр.',
  patriot: 'Патриот',
  armtek: 'Армтек',
  npn: 'НПН',
  ug_bn: 'ЮГ-б/н',
  mikano: 'АВТОМОДУЛЬ',
  avtodinamika: 'Автодинамика',
  avtoPartner: 'АвтоПартнер',
  turboCars: 'Турбокарс',
};

const normalizeStr = (str: string): string =>
  str.toLowerCase().replace(/[^a-zа-яё0-9]/gi, '');

export const getOrders = async (req: Request, res: Response) => {
  const suppliers = req.query.suppliers as string | undefined;
  const status = req.query.status as string | undefined;
  const search = req.query.search as string | undefined;
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 100;
  const fromDate = req.query.fromDate as string | undefined;
  const toDate = req.query.toDate as string | undefined;

  const query: Record<string, unknown> = {};

  if (suppliers) {
    query.supplier = { $in: suppliers.split(',') };
  }

  if (status) {
    query.status = { $in: status.split(',') };
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

  if (search) {
    const tokens = search.trim().split(/\s+/).filter(Boolean);

    const searchConditions = tokens.map((token) => {
      const normalizedToken = normalizeStr(token);

      const cleanedArticleToken = cleanArticleString(token);
      const articleCondition =
        cleanedArticleToken.length > 0
          ? {
              article: {
                $regex: cleanedArticleToken.split('').join('[^A-Z0-9А-ЯЁ]*'),
                $options: 'i',
              },
            }
          : { article: { $regex: token, $options: 'i' } };

      const brandVariants = expandBrandToken(token);
      const brandConditions = brandVariants.map((variant) => ({
        brand: { $regex: variant, $options: 'i' },
      }));

      const orConditions: Record<string, unknown>[] = [
        { orderId: { $regex: token, $options: 'i' } },
        ...brandConditions,
        articleCondition,
        { name: { $regex: token, $options: 'i' } },
        { comment: { $regex: token, $options: 'i' } },
      ];

      for (const [key, ruName] of Object.entries(supplierNameMap)) {
        if (normalizeStr(ruName).includes(normalizedToken)) {
          orConditions.push({ supplier: key });
        }
      }

      return { $or: orConditions };
    });

    query.$and = searchConditions;
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

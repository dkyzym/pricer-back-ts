import { Request, Response } from 'express';
import { getItemsListByArticleService } from 'services/profit/getItemsListByArticleService';

export const getItemsListByArticleController = async (
  req: Request,
  res: Response
) => {
  const { article } = req.query;

  const data = await getItemsListByArticleService(article as string);

  res.json(data);
};

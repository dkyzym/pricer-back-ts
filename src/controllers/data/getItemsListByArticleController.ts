import { Request, Response } from 'express';
import { getItemsListByArticleService } from 'services/profit/getItemsListByArticleService';
import { isBrandMatch } from 'utils/data/isBrandMatch';

export const getItemsListByArticleController = async (
  req: Request,
  res: Response
) => {
  const { article } = req.query;
  const brand = 'gazpromneft';

  const data = await getItemsListByArticleService(article as string);

  const relevantItems = data.filter((item: any) =>
    isBrandMatch(brand, item.brand)
  );

  res.json(relevantItems);
};

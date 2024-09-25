import { Request, Response } from 'express';
import { getItemsListByArticleService } from 'services/profit/getItemsListByArticleService';
import { getItemsWithRest } from 'services/profit/getItemsWithRest';
import { isBrandMatch } from 'utils/data/isBrandMatch';
import { parseApiResponse } from '../../utils/data/profit/parseApiResponse';

export const getItemsListByArticleController = async (
  req: Request,
  res: Response
) => {
  const { article } = req.query;
  const brand = 'gazpromneft';
  //sp1165
  //2389901318

  const data = await getItemsListByArticleService(article as string);

  const itemsWithRest = await getItemsWithRest(data);

  const relevantItems = itemsWithRest.filter((item: any) => {
    return isBrandMatch(brand, item.brand);
  });

  const parsedData = parseApiResponse(relevantItems, brand);

  res.json(parsedData);
};

import { Request, Response } from 'express';
import { getItemsListByArticleService } from 'services/profit/getItemsListByArticleService';
import { getItemsWithRest } from 'services/profit/getItemsWithRest';
import { isBrandMatch } from 'utils/data/isBrandMatch';

export const getItemsListByArticleController = async (
  req: Request,
  res: Response
) => {
  const { article } = req.query;
  const brand = 'sangsin';
  //sp1165
  //2389901318

  const data = await getItemsListByArticleService(article as string);

  const itemsWithRest = await getItemsWithRest(data);

  const relevantItems = itemsWithRest.filter((item: any) => {
    return isBrandMatch(brand, item.brand);
  });

  // const addToCardTestItem = [
  //   {
  //     id: '54479',
  //     article: 'SP1165',
  //     description: 'Колодки тормозные ВАЗ 2108-099 перед.',
  //     brand: 'HI-Q',
  //     original: '0',
  //     brand_warranty: '0',
  //     products: {
  //       '878202cb3d160d368c1ffda4cc7483b8': {
  //         donkey: 'ae15e41cbe2460d40771d890cb931b2f',
  //         warehouse_id: '1799',
  //         brand_id: 2996,
  //         brand: 'HI-Q',
  //         article: 'SP1165',
  //         product_code: '1eaadb093ac2d5b5dd760a7b7eccd8d6',
  //         multi: 1,
  //         quantity: '>100',
  //         price: 813.05,
  //         returnable: -1,
  //         description: 'Колодка передняя SANGSIN ВАЗ 2108-2115',
  //         article_id: '54479',
  //         return_days: 14,
  //         brand_info: true,
  //         brand_warranty: false,
  //         original: false,
  //         waitings: 0,
  //         custom_warehouse_name: 'Москва-AB3',
  //         show_date: '33 ч.',
  //         delivery_time: 33,
  //         allow_return: '1',
  //         delivery_date: '2024-09-27 08:30:00',
  //         delivery_probability: 92.41,
  //       },
  //       someElseItemID: {
  //         // ...
  //       },
  //     },
  //   },
  // ];

  res.json(relevantItems);
};

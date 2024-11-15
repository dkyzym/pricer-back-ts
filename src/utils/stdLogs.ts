import chalk from 'chalk';
import {
  accountAlias,
  ItemToParallelSearch,
  SearchResultsParsed,
  SupplierName,
} from 'types';
import { logger } from '../config/logger';

export const logResultCount = (
  item: ItemToParallelSearch,
  supplier: SupplierName,
  allResults: SearchResultsParsed[],
  accountAlias?: accountAlias
) =>
  logger.info(
    chalk.bgMagentaBright(
      `Найдено для ${item.article} ${item.brand} -  ${supplier}_${accountAlias || ''}: ${allResults ? allResults.length : 0}`
    )
  );

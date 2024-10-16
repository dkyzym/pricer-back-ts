import chalk from 'chalk';
import { ItemToParallelSearch, SearchResultsParsed, SupplierName } from 'types';
import { logger } from '../config/logger';

export const logResultCount = (
  item: ItemToParallelSearch,
  supplier: SupplierName,
  allResults: SearchResultsParsed[]
) =>
  logger.info(
    chalk.bgMagentaBright(
      `Найдено для ${item.article} ${item.brand} -  ${supplier}: ${allResults ? allResults.length : 0}`
    )
  );

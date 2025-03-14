import chalk from 'chalk';
import {
  ItemToParallelSearch,
  SearchResultsParsed,
  SupplierName,
} from 'types/index.js';
import { Logger } from 'winston';

export const logResultCount = (
  item: ItemToParallelSearch,
  userLogger: Logger,
  supplier: SupplierName,
  allResults: SearchResultsParsed[]
) =>
  userLogger.info(
    chalk.bgMagentaBright(
      `Найдено для ${item.article} ${item.brand} -  ${supplier}}: ${allResults ? allResults.length : 0}`
    )
  );

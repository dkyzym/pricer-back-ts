import chalk from 'chalk';

import { Logger } from 'winston';
import { SupplierName } from '../types/common.types.js';
import { ItemToParallelSearch, SearchResultsParsed } from '../types/search.types.js';

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

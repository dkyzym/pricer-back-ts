import { setTimeout as delayMs } from 'node:timers/promises';

import { abcpHtmlHasUnpricedResultRows } from './abcpUnpricedResultRowsProbe.js';

/** Пауза перед повторным GET, когда ABCP отдал таблицу без цен в data-output-price. */
export const ABCP_UNPRICED_HTML_RETRY_DELAY_MS = 700;

export const ABCP_UNPRICED_HTML_MAX_EXTRA_REQUESTS = 1;

/**
 * Если в HTML уже есть строки resultTr2, но ни одна без положительной data-output-price,
 * выполняет до MAX дополнительных GET через refetch (та же страница поиска/карточки).
 * Используется и в поиске ABCP, и в add-to-cart / актуализации корзины.
 */
export const resolveAbcpHtmlAfterUnpricedRetries = async (
  initialHtml: string,
  refetch: () => Promise<string>
): Promise<string> => {
  let html = initialHtml;
  let extra = 0;
  while (
    extra < ABCP_UNPRICED_HTML_MAX_EXTRA_REQUESTS &&
    abcpHtmlHasUnpricedResultRows(html)
  ) {
    extra += 1;
    await delayMs(ABCP_UNPRICED_HTML_RETRY_DELAY_MS);
    html = await refetch();
  }
  return html;
};

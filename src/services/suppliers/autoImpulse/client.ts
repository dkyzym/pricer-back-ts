import { createHtmlClient } from '../../platforms/abcp/parser/createHtmlClient.js';

/** Клиент ABCP-парсера для поставщика AutoImpulse */
export const autoImpulseClient = createHtmlClient({
  supplierName: 'AutoImpulse',
  baseUrl: process.env.AUTOIMPULSE_URL!,
  credentials: {
    username: process.env.AUTOIMPULSE_USERNAME,
    password: process.env.AUTOIMPULSE_PASSWORD,
  },
  loggedInIndicator: process.env.ABCP_LOGGED_INDICATOR!,
});

import { createAbcpClientParser } from '../../platforms/abcp/parser/abcpClientParser.js';

/** Клиент ABCP-парсера для поставщика Mikano */
export const mikanoClient = createAbcpClientParser({
  supplierName: 'mikano',
  baseUrl: process.env.MIKANO_LOGIN_URL!,
  credentials: {
    username: process.env.MIKANO_USERNAME,
    password: process.env.MIKANO_PASSWORD,
  },
  loggedInIndicator: process.env.ABCP_LOGGED_INDICATOR!,
});

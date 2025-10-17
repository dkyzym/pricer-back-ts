
import { createAbcpClient } from "./abcpClient.js";

// --- Конфигурация для Mikano ---
export const mikanoClient = createAbcpClient({
  supplierName: 'mikano',
  baseUrl: process.env.MIKANO_LOGIN_URL!,
  credentials: {
    username: process.env.MIKANO_USERNAME,
    password: process.env.MIKANO_PASSWORD,
  },
  loggedInIndicator: 'Кизим',
});


// --- Конфигурация для AutoImpulse ---
export const autoImpulseClient = createAbcpClient({
    supplierName: 'AutoImpulse',
    baseUrl: 'https://lnr-auto-impulse.ru',
    credentials: {
      username: process.env.AUTOIMPULSE_USERNAME,
      password: process.env.AUTOIMPULSE_PASSWORD,
    },
    loggedInIndicator: 'Кизим',
});


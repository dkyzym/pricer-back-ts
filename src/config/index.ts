import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const PORT = process.env.PORT || 3000;

/** Токен для GET /api/health/detailed (заголовок X-Metrics-Token). Без переменной — детальные метрики отключены. */
export const HEALTH_METRICS_TOKEN = process.env.HEALTH_METRICS_TOKEN?.trim() || undefined;

/**
 * JSON-файл с сериализованным CookieJar для автокомплита UG (tough-cookie).
 * По умолчанию — `data/ug-autocomplete-cookies.json` в рабочей директории процесса.
 */
export const UG_AUTOCOMPLETE_COOKIE_FILE =
  process.env.UG_AUTOCOMPLETE_COOKIE_FILE?.trim() ||
  path.join(process.cwd(), 'data', 'ug-autocomplete-cookies.json');

export const CLIENT_BUILD_PATH = process.env.CLIENT_BUILD_PATH || '../pricer-front/dist';
const rawClientUrls = [
  process.env.CLIENT_URL,
  process.env.HTTP_SITE,
  process.env.HTTPS_SITE,
  'http://localhost:5173',
  'http://localhost:3000',
  'https://automir.win',
  'http://automir.win',
];

const isNonEmptyString = (value: string | undefined): value is string => {
  return typeof value === 'string' && value.trim().length > 0;
};

export const CLIENT_URL = [...new Set(rawClientUrls.filter(isNonEmptyString))];

export const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow non-browser requests without Origin (curl, server-to-server, health checks).
    if (!origin) {
      return callback(null, true);
    }

    if (CLIENT_URL.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('CORS origin is not allowed'));
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
};

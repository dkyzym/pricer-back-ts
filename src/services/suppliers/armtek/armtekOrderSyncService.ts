import axios from 'axios';
import { Logger } from 'winston';
import type { ArmtekOrderReportRow } from './armtekOrderSync.types.js';

const REPORT_TIMEOUT_MS = 60_000;

const formatCalendarYmd = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
};

const asRecord = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

/** Ищем первый массив строк отчёта среди известных ключей — Armtek может менять структуру. */
const extractReportRows = (data: unknown): ArmtekOrderReportRow[] => {
  const root = asRecord(data);
  if (!root) return [];

  const st = root.STATUS;
  if ((typeof st === 'number' && st !== 200) || (typeof st === 'string' && st !== '' && st !== '200')) {
    return [];
  }

  const resp = asRecord(root.RESP);
  const candidates = [
    root.data, root.DATA, root.table, root.TABLE, root.rows, root.ROWS, root.items, root.ITEMS,
    ...(resp ? [resp.data, resp.DATA, resp.table, resp.TABLE, resp.rows, resp.ROWS, resp.items, resp.ITEMS] : []),
  ];

  for (const c of candidates) {
    if (Array.isArray(c)) {
      return c.filter((x): x is ArmtekOrderReportRow => x != null && typeof x === 'object');
    }
  }
  return [];
};

/** Если Content-Type не json — пробуем извлечь объект из строки. */
const coerceToObject = (data: unknown): unknown => {
  if (data !== null && typeof data === 'object') return data;
  if (typeof data === 'string') {
    const t = data.trim();
    const start = t.indexOf('{');
    const end = t.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try { return JSON.parse(t.slice(start, end + 1)) as unknown; } catch { /* fall through */ }
    }
  }
  return data;
};

/**
 * Единственный запрос к Armtek: POST getOrderReportByDate за интервал.
 * Возвращает строки отчёта «как есть» для последующего маппинга.
 */
export const fetchArmtekOrders = async (
  logger: Logger,
  targetSyncDate: Date,
  signal?: AbortSignal,
): Promise<ArmtekOrderReportRow[]> => {
  const baseUrl = process.env.ARMTEK_BASE_URL?.trim().replace(/\/+$/, '') || '';
  if (!baseUrl) throw new Error('Armtek: не задан ARMTEK_BASE_URL');

  const kunrg =
    process.env.ARMTEK_KUNNR?.trim() ||
    process.env.KUNNR?.trim() ||
    process.env.ARMTEK_KUNRG?.trim() ||
    process.env.KUNRG?.trim() ||
    '';
  if (!kunrg) throw new Error('Armtek: не настроен KUNRG (KUNNR / ARMTEK_KUNNR в .env)');

  const vkorg = process.env.VKORG?.trim() || '4000';
  const auth = {
    username: process.env.ARMTEK_USERNAME || '',
    password: process.env.ARMTEK_PASSWORD || '',
  };

  const scrdate = formatCalendarYmd(targetSyncDate);
  const ecrdate = formatCalendarYmd(new Date());

  const url = `${baseUrl}/api/ws_reports/getOrderReportByDate?format=json`;
  const body = {
    VKORG: vkorg,
    KUNNR_RG: kunrg,
    SCRDATE: scrdate,
    ECRDATE: ecrdate,
    TYPEZK_SALE: '1',
    TYPEZK_RETN: '0',
    format: 'json',
  };

  try {
    const { data: rawData } = await axios.post<unknown>(
      url,
      body,
      { headers: { 'Content-Type': 'application/json' }, auth, timeout: REPORT_TIMEOUT_MS, signal },
    );

    const data = coerceToObject(rawData);
    return extractReportRows(data);
  } catch (err) {
    if (axios.isCancel(err) || (err instanceof Error && err.name === 'AbortError')) {
      return [];
    }
    if (axios.isAxiosError(err)) {
      logger.error('[ArmtekOrderSync] getOrderReportByDate: ошибка HTTP', {
        httpStatus: err.response?.status,
        message: err.message,
      });
    }
    throw err;
  }
};

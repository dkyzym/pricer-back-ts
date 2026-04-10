import axios from 'axios';
import { getAutocomplete } from './getAutocomplete.js';

export type UgAutocompleteProbeResult = {
  checkedAt: string;
  durationMs: number;
  ok: boolean;
  stage: 'tips' | 'error';
  httpStatus?: number;
  hint?: string;
  resultCount?: number;
  errorMessage?: string;
};

/**
 * Лёгкая проверка цепочки UG: тот же путь, что и у пользовательского автокомплита.
 * Не вызывать часто — каждый вызов бьёт по ugautopart.ru.
 */
export const probeUgAutocomplete = async (): Promise<UgAutocompleteProbeResult> => {
  const started = Date.now();
  const checkedAt = new Date().toISOString();

  try {
    const data = await getAutocomplete('ф');
    const durationMs = Date.now() - started;

    if (Array.isArray(data)) {
      return { checkedAt, durationMs, ok: true, stage: 'tips', resultCount: data.length };
    }

    return {
      checkedAt,
      durationMs,
      ok: false,
      stage: 'tips',
      hint: 'unexpected_payload',
    };
  } catch (error) {
    const durationMs = Date.now() - started;
    const message = error instanceof Error ? error.message : String(error);
    const httpStatus = axios.isAxiosError(error)
      ? error.response?.status
      : undefined;

    return {
      checkedAt,
      durationMs,
      ok: false,
      stage: 'error',
      httpStatus,
      errorMessage: message,
    };
  }
};

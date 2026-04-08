/**
 * Узкие типы для синка заказов Armtek (getOrderReportByDate).
 * Реальный JSON может отличаться регистром ключей — pickStr допускает оба варианта.
 */

/** Строка отчёта getOrderReportByDate (после нормализации ключей). */
export type ArmtekOrderReportRow = Record<string, unknown>;

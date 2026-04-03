import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AxiosResponse } from 'axios';
import { getAxiosInstance } from '../../../infrastructure/http/apiClient.js';
import { SupplierName } from '../../../types/common.types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Каталог `src/data` — тот же уровень, что и для all-brands.json. */
export const ABCP_CHECKOUT_OPTIONS_DATA_DIR = path.resolve(__dirname, '../../../data');

/** Элемент ответа GET /basket/paymentMethods (см. docs/suppliers/abcp-api.md). */
export interface AbcpPaymentMethod {
  id: string | number;
  name: string;
}

/** Элемент ответа GET /basket/shipmentMethods. */
export interface AbcpShipmentMethod {
  id: string | number;
  name: string;
}

/** Элемент ответа GET /basket/shipmentAddresses. */
export interface AbcpShipmentAddress {
  id: string | number;
  name: string;
}

export interface AbcpCheckoutOptionsBundle {
  paymentMethods: AbcpPaymentMethod[];
  shipmentMethods: AbcpShipmentMethod[];
  shipmentAddresses: AbcpShipmentAddress[];
}

const extractAbcpCheckoutList = <T>(
  settled: PromiseSettledResult<AxiosResponse<T[]>>,
): T[] => {
  if (settled.status === 'rejected') return [];
  const { data } = settled.value;
  return Array.isArray(data) ? data : [];
};

/**
 * Параллельно запрашивает способы оплаты, доставки и адреса корзины ABCP.
 * При 404 или иной ошибке по отдельному эндпоинту возвращает для него пустой массив
 * (площадка может не поддерживать опцию).
 */
export const getAbcpCheckoutOptions = async (
  supplierAlias: string,
): Promise<AbcpCheckoutOptionsBundle> => {
  const axiosInstance = await getAxiosInstance(supplierAlias as SupplierName);

  const [payment, shipment, addresses] = await Promise.allSettled([
    axiosInstance.get<AbcpPaymentMethod[]>('/basket/paymentMethods'),
    axiosInstance.get<AbcpShipmentMethod[]>('/basket/shipmentMethods'),
    axiosInstance.get<AbcpShipmentAddress[]>('/basket/shipmentAddresses'),
  ]);

  return {
    paymentMethods: extractAbcpCheckoutList<AbcpPaymentMethod>(payment),
    shipmentMethods: extractAbcpCheckoutList<AbcpShipmentMethod>(shipment),
    shipmentAddresses: extractAbcpCheckoutList<AbcpShipmentAddress>(addresses),
  };
};

export type AbcpCheckoutOptionsSupplierResult =
  | { alias: string; status: 'fulfilled'; value: AbcpCheckoutOptionsBundle }
  | { alias: string; status: 'rejected'; reason: string };

/**
 * Для каждого поставщика вызывает getAbcpCheckoutOptions через Promise.allSettled.
 * Удобно для единоразового сбора без падения всего прогона из‑за одного alias.
 */
export const getAbcpCheckoutOptionsForSuppliersAllSettled = async (
  supplierAliases: readonly string[],
): Promise<AbcpCheckoutOptionsSupplierResult[]> => {
  const settled = await Promise.allSettled(
    supplierAliases.map((alias) => getAbcpCheckoutOptions(alias)),
  );

  return supplierAliases.map((alias, i) => {
    const entry = settled[i]!;
    if (entry.status === 'fulfilled') {
      return { alias, status: 'fulfilled' as const, value: entry.value };
    }
    return {
      alias,
      status: 'rejected' as const,
      reason: entry.reason instanceof Error ? entry.reason.message : String(entry.reason),
    };
  });
};

export interface AbcpCheckoutOptionsReportFilePayload {
  generatedAt: string;
  suppliers: AbcpCheckoutOptionsSupplierResult[];
}

/**
 * Собирает опции по списку поставщиков и записывает JSON в `src/data/`.
 *
 * @param supplierAliases — ключи из конфига (ug, patriot, …)
 * @param fileName — имя файла внутри `src/data/` (по умолчанию с меткой времени)
 * @returns абсолютный путь к записанному файлу
 */
export const writeAbcpCheckoutOptionsReportToDataFile = async (
  supplierAliases: readonly string[],
  fileName?: string,
): Promise<string> => {
  const suppliers = await getAbcpCheckoutOptionsForSuppliersAllSettled(supplierAliases);
  const payload: AbcpCheckoutOptionsReportFilePayload = {
    generatedAt: new Date().toISOString(),
    suppliers,
  };

  await mkdir(ABCP_CHECKOUT_OPTIONS_DATA_DIR, { recursive: true });
  const name =
    fileName ?? `abcp-checkout-options-${Date.now()}.json`;
  const safeName = path.basename(name);
  const filePath = path.join(ABCP_CHECKOUT_OPTIONS_DATA_DIR, safeName);

  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return filePath;
};


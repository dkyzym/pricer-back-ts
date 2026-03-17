import { ABCP_SERVICE_PATHS } from '../../../../config/api/config.js';
import { getAxiosInstance } from '../../../../infrastructure/http/apiClient.js';
import type { AbcpBrandItem } from '../abcpPlatform.types.js';
import { SupplierName } from '../../../../types/common.types.js';

export async function fetchAbcpAllBrands(
  supplierKey: SupplierName = 'ug'
): Promise<AbcpBrandItem[]> {
  const axiosInstance = await getAxiosInstance(supplierKey);
  const { data } = await axiosInstance.get<AbcpBrandItem[]>(
    ABCP_SERVICE_PATHS.Articles_brands
  );
  return Array.isArray(data) ? data : [];
}

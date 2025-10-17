import { brandGroupsMap } from '@constants/brandGroupsMap.js';
import { normalizeBrandName } from './normalizeBrandName.js';

export const getStandardBrandName = (brand: string): string | null => {
  const normalizedBrand = normalizeBrandName(brand);

  for (const group of brandGroupsMap) {
    for (const variant of group) {
      if (normalizeBrandName(variant) === normalizedBrand) {
        return normalizeBrandName(group[0]);
      }
    }
  }
  return null;
};

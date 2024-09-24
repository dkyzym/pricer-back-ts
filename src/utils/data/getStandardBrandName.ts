import { brandGroups } from './brandGroups';
import { normalizeBrandName } from './normalizeBrandName';

export const getStandardBrandName = (brand: string): string | null => {
  const normalizedBrand = normalizeBrandName(brand);

  for (const group of brandGroups) {
    for (const variant of group) {
      if (normalizeBrandName(variant) === normalizedBrand) {
        return normalizeBrandName(group[0]);
      }
    }
  }
  return null;
};

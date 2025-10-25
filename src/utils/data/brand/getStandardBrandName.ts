import { brandGroupsMap } from '@constants/brandGroupsMap.js';
import { standardizeString } from '../standardizeString.js';

export const getStandardBrandName = (brand: string): string | null => {
  const normalizedBrand = standardizeString(brand);

  for (const group of brandGroupsMap) {
    for (const variant of group) {
      if (standardizeString(variant) === normalizedBrand) {
        return standardizeString(group[0]);
      }
    }
  }
  return null;
};

import { brandGroupsMap } from '@constants/brandGroupsMap.js';
import { standardizeString } from './standardizeString.js';

/**
 * Ищет токен в brandGroupsMap через standardizeString и возвращает
 * все варианты написания бренда из найденной группы.
 * Если совпадений нет — возвращает исходный токен.
 */
export const expandBrandToken = (token: string): string[] => {
  const normalizedToken = standardizeString(token);

  for (const group of brandGroupsMap) {
    if (group.some((variant) => standardizeString(variant) === normalizedToken)) {
      return group;
    }
  }

  return [token];
};

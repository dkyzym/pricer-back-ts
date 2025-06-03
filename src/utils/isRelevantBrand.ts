import { isBrandMatch } from './data/isBrandMatch';
import { isContainsBrandName } from './data/isContainsBrandName';

export const isRelevantBrand = (expected: string, actual: string): boolean => {
  if (isBrandMatch(expected, actual)) return true;

  const longEnough =
    expected.replace(/\s+/g, '').length >= 4 &&
    actual.replace(/\s+/g, '').length >= 4;

  return longEnough && isContainsBrandName(expected, actual);
};

import stringSimilarity from 'string-similarity';
import { getStandardBrandName } from './getStandardBrandName.js';
import { standardizeString } from './standardizeString.js';

export const isBrandMatch = (
  expectedBrand: string,
  actualBrand: string
): boolean => {
  const expectedStandard = getStandardBrandName(expectedBrand);
  const actualStandard = getStandardBrandName(actualBrand);

  if (expectedStandard && actualStandard) {
    return expectedStandard === actualStandard;
  }

  const normalizedExpected = standardizeString(expectedBrand);
  const normalizedActual = standardizeString(actualBrand);
  const similarity = stringSimilarity.compareTwoStrings(
    normalizedExpected,
    normalizedActual
  );

  return similarity >= 0.8;
};

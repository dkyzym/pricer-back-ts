import { standardizeString } from '../standardizeString.js';

export const isContainsBrandName = (
  expectedBrand: string,
  actualBrand: string
): boolean => {
  const normalizedExpected = standardizeString(expectedBrand);
  const normalizedActual = standardizeString(actualBrand);

  return (
    normalizedExpected.includes(normalizedActual) ||
    normalizedActual.includes(normalizedExpected)
  );
};

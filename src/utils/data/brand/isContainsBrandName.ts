import { normalizeBrandName } from './normalizeBrandName.js';

export const isContainsBrandName = (
  expectedBrand: string,
  actualBrand: string
): boolean => {
  const normalizedExpected = normalizeBrandName(expectedBrand);
  const normalizedActual = normalizeBrandName(actualBrand);

  return (
    normalizedExpected.includes(normalizedActual) ||
    normalizedActual.includes(normalizedExpected)
  );
};

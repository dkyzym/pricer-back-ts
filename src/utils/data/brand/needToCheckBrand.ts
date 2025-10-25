import { standardizeString } from './standardizeString.js';

export const needToCheckBrand = (
  expectedBrand: string,
  actualBrand: string
) => {
  return standardizeString(expectedBrand) !== standardizeString(actualBrand);
};

import { formatText } from '../formatText.js';

export const needToCheckBrand = (
  expectedBrand: string,
  actualBrand: string
) => {
  return formatText(expectedBrand) !== formatText(actualBrand);
};

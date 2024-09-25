import { formatText } from './formatText';

export const needToCheckBrand = (
  expectedBrand: string,
  actualBrand: string
) => {
  return formatText(expectedBrand) !== formatText(actualBrand);
};

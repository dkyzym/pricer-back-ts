// import stringSimilarity from 'string-similarity';
import chalk from 'chalk';
import { getStandardBrandName } from './getStandardBrandName';
// import { normalizeBrandName } from './normalizeBrandName';

export const isBrandMatch = (
  expectedBrand: string,
  actualBrand: string
): boolean => {
  console.log(
    chalk.bgMagenta(
      'on isBrandMatch start: ' +
        `expectedBrand ${expectedBrand}` +
        `actualBrand ${actualBrand}`
    )
  );
  const expectedStandard = getStandardBrandName(expectedBrand);
  const actualStandard = getStandardBrandName(actualBrand);

  if (expectedStandard && actualStandard) {
    return expectedStandard === actualStandard;
  }

  // Если один из брендов не найден в brandGroups, используем нечеткое сравнение
  //   const normalizedExpected = normalizeBrandName(expectedBrand);
  //   const normalizedActual = normalizeBrandName(actualBrand);
  //   const similarity = stringSimilarity.compareTwoStrings(
  //     normalizedExpected,
  //     normalizedActual
  //   );

  //   return similarity >= 0.8; // Порог схожести можно настроить
  console.log('true ', expectedBrand, actualBrand);
  return false;
};

import { Page } from 'puppeteer';
import { SupplierName } from 'types';
import { getSupplierData } from 'utils/data/getSupplierData';
import { clickOutsideInput, fillField } from 'utils/pupHelpers/pageHelpers';
import { parseAutocompleteResults } from 'utils/pupHelpers/parseAutocompleteResults';

export const autocompleteUgService = async (
  page: Page,
  query: string,
  supplier: SupplierName
) => {
  const { selectors } = getSupplierData(supplier);

  await fillField(page, selectors.input, query);

  await clickOutsideInput(query, page);

  if (query.trim() === '' || query.trim().length < 3) {
    return [];
  }

  const result = await parseAutocompleteResults(page, query);

  return result;
};

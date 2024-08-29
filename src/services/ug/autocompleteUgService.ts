import { Page } from 'puppeteer';
import { SupplierName } from 'types';
import { getSupplierData } from 'utils/data/getSupplierData';
import { fillField } from 'utils/pupHelpers/pageHelpers';
import { parseAutocompleteResults } from 'utils/pupHelpers/parseAutocompleteResults';

export const autocompleteUgService = async (
  page: Page,
  query: string,
  supplier: SupplierName
) => {
  const { selectors } = getSupplierData(supplier);

  await fillField(page, selectors.input, query);

  const result = await parseAutocompleteResults(page);

  //   console.log(result);
};

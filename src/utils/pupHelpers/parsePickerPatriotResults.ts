import {
  ItemToParallelSearch,
  ParallelSearchParams,
  SearchResultsParsed,
  SupplierName,
} from 'types';

export const parsePickedPatriotResults = async ({
  page,
  item,
  supplier,
}: ParallelSearchParams): Promise<SearchResultsParsed[]> => {
  try {
    await page.waitForNetworkIdle();
    return await page.evaluate(
      (item: ItemToParallelSearch, supplier: SupplierName) => {
        const itemRowSelector = `tr[ data-current-brand-number="${item.article}_${item.brand}" i]`;
        const itemRows = document.querySelectorAll(itemRowSelector);

        if (itemRows.length === 0) {
          return [];
        }

        const closestWarehouseItemRow = Array.from(itemRows).filter((row) => {
          const textContent = row.textContent?.trim();

          return textContent?.includes('Луганск');
        });

        if (closestWarehouseItemRow.length < 1) {
          return;
        }

        const data: SearchResultsParsed[] = [];

        closestWarehouseItemRow.forEach((row) => {
          const fakeInputElement = row.querySelector(
            'input.addToBasketLinkFake'
          );

          const descriptionElement = row.querySelector(
            '.resultDescription'
          ) as HTMLElement;

          const warehouseElement = row.querySelector(
            '.resultWarehouse'
          ) as HTMLElement;

          const imageElement = row.querySelector('img.searchResultImg');

          const product: SearchResultsParsed = {
            article: fakeInputElement?.getAttribute('number') || '',
            availability:
              parseInt(
                fakeInputElement?.getAttribute('availability') || '0',
                10
              ) || 0,
            brand: fakeInputElement?.getAttribute('brand') || '',
            deadline:
              parseInt(
                fakeInputElement?.getAttribute('data-deadline') || '0'
              ) || 0,
            deadLineMax:
              parseInt(
                fakeInputElement?.getAttribute('data-deadline-max') || '0'
              ) || 0,
            description: descriptionElement?.innerText.trim() || '',
            id: fakeInputElement?.getAttribute('searchresultuniqueid') || '',
            imageUrl: imageElement?.getAttribute('src') || '',
            price:
              parseFloat(row.getAttribute('data-output-price') || '0') || 0,
            probability: 99,
            supplier,
            warehouse: warehouseElement?.innerText.trim() || '',
          };
          data.push(product);
        });

        return data;
      },
      item,
      supplier
    );
  } catch (error) {
    console.error(`Error in parsePickedPatriotResults: ${error}`);
    return [];
  }
};

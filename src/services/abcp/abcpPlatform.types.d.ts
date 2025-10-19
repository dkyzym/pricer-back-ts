export type AbcpSupplierAlias =
  | 'ug'
  | 'patriot'
  | 'ug_f'
  | 'npn'
  | 'ug_bn'
  | 'avtodinamika';

export interface AbcpArticleSearchResult {
  distributorId: number;
  grp: null;
  code: string | '';
  brand: string;
  number: string;
  numberFix: string;
  description: string;
  availability: number;
  packing: number;
  deliveryPeriod: number;
  deliveryPeriodMax: number;
  deadlineReplace: '';
  distributorCode: '';
  supplierCode: number;
  supplierColor: null;
  supplierDescription: '';
  itemKey: string;
  price: number;
  weight: number;
  volume: null;
  lastUpdateTime: string | Date;
  additionalPrice: number;
  noReturn: boolean;
  isUsed: boolean;
  meta: {
    productId: number;
    wearout: number;
    isUsed: boolean;
    images: null;
    abcpWh: string;
  };
  deliveryProbability: 0;
}

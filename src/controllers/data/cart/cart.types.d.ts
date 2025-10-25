export interface AddToCartConfig {
  id: string;
  warehouse: string;
  quantity: number;
  code: string;
  supplier?: SupplierName;
}

//** Параметры для добавления в корзину ЮГ */
export interface BasketPositionUG {
  number: string;
  brand: string;
  supplierCode: string;
  itemKey: string;
  quantity: number;
}

export interface UgCartResponse {
  status: 1 | 0;
  errorMessage?: string;
  positions: Array<{
    number: string;
    brand: string;
    supplierCode: string;
    quantity: string;
    numberFix: string;
    deadline: number;
    deadlineMax: number;
    description: string;
    status: 1 | 0;
    errorMessage?: string;
  }>;
}

export interface AddResultXML {
  AddResult: {
    Message: string;
    ID: string;
    OrderedQTY: string;
    OrderedCode: string;
  };
}

export type CartHandlerResponse = {
  success: boolean;
  message: string;
  data?: any;
};

export type CartHandler = (data: any) => Promise<CartHandlerResponse>;

export type ProfitAPIresponse = { status: "success" | 'no - quantity' | 'less' | 'error', total: number, count: number }




export interface FourPXProduct {
    sku: string;
    name: string;
    quantity: number;
    warehouseId: string;
  }
  
  export interface FourPXOrder {
    orderId: string;
    items: Array<{
      sku: string;
      quantity: number;
    }>;
    consignee: {
      name: string;
      address: string;
      city: string;
      country: string;
      postalCode: string;
    };
    platformId: string;
  }
  
  export interface FourPXInventory {
    sku: string;
    quantity: number;
    warehouseId: string;
    updateTime: string;
  }
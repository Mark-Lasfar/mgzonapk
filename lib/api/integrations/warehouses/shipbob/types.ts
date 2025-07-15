export interface ShipBobProduct {
    id: string;
    sku: string;
    name: string;
    quantity: number;
    warehouseId: string;
  }
  
  export interface ShipBobOrder {
    orderId: string;
    items: Array<{
      productId: string;
      quantity: number;
    }>;
    shippingAddress: {
      name: string;
      street: string;
      city: string;
      state: string;
      country: string;
      postalCode: string;
    };
    platformId: string;
  }
  
  export interface ShipBobInventory {
    sku: string;
    quantity: number;
    warehouseId: string;
    lastUpdated: string;
  }
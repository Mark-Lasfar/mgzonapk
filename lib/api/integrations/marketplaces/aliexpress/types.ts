export interface AliExpressProduct {
    productId: string;
    title: string;
    quantity: number;
  }
  
  export interface AliExpressOrder {
    orderId: string;
    items: Array<{
      productId: string;
      quantity: number;
    }>;
    receiver: {
      name: string;
      address: string;
      city: string;
      country: string;
      zipCode: string;
    };
  }
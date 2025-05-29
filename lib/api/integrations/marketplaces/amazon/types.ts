export interface AmazonProduct {
    sku: string;
    asin: string;
    title: string;
    quantity: number;
  }
  
  export interface AmazonOrder {
    orderId: string;
    items: Array<{
      sku: string;
      quantity: number;
    }>;
    shippingAddress: {
      name: string;
      addressLine1: string;
      city: string;
      stateOrRegion: string;
      countryCode: string;
      postalCode: string;
    };
  }
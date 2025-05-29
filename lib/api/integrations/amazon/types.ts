export interface AmazonFBAProduct {
    sku: string;
    fnsku?: string;
    asin?: string;
    condition: 'New' | 'Used' | 'Refurbished';
    quantity: number;
    fulfillmentChannelId?: string;
  }
  
  export interface AmazonFBAOrder {
    amazonOrderId: string;
    sellerOrderId: string;
    fulfillmentAction: 'Ship' | 'Hold';
    displayableOrderId: string;
    displayableOrderDate: string;
    displayableOrderComment?: string;
    shippingSpeedCategory: 'Standard' | 'Expedited' | 'Priority';
    destinationAddress: {
      name: string;
      addressLine1: string;
      addressLine2?: string;
      city: string;
      stateOrRegion: string;
      postalCode: string;
      countryCode: string;
      phoneNumber?: string;
    };
    items: Array<{
      sellerSku: string;
      quantity: number;
      displayableComment?: string;
      perUnitDeclaredValue?: {
        currencyCode: string;
        value: string;
      };
    }>;
  }
  
  export interface AmazonFBAInventory {
    sku: string;
    fnsku: string;
    asin: string;
    condition: string;
    totalQuantity: number;
    inboundQuantity: number;
    availableQuantity: number;
    reservedQuantity: number;
    fulfillableQuantity: number;
    unfulfillableQuantity: number;
    lastUpdatedTime: string;
  }
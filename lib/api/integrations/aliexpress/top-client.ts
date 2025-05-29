import { IProductInput } from '@/types';

export interface AliExpressProduct {
  id: string;
  title: string;
  price: number;
  inventory: number;
  shipping: {
    method: string;
    cost: number;
  };
  variations: Array<{
    sku: string;
    attributes: Record<string, string>;
    price: number;
    inventory: number;
  }>;
  metadata: Record<string, any>;
}

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: Array<{
    sku: string;
    error: string;
  }>;
}

export interface AliExpressClientConfig {
  apiKey: string;
  apiSecret: string;
  accessToken?: string;
  sandbox?: boolean;
}

export class AliExpressClient {
  private baseUrl: string;
  private headers: HeadersInit;
  private accessToken?: string;

  constructor(config: AliExpressClientConfig) {
    this.baseUrl = config.sandbox
      ? 'https://api.sandbox.aliexpress.com/v2'
      : 'https://api.aliexpress.com/v2';

    this.headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
      'X-API-Secret': config.apiSecret
    };

    if (config.accessToken) {
      this.accessToken = config.accessToken;
      this.headers['X-Access-Token'] = config.accessToken;
    }
  }

  async getProducts(): Promise<AliExpressProduct[]> {
    try {
      const response = await fetch(`${this.baseUrl}/products`, {
        headers: this.headers
      });

      if (!response.ok) {
        throw new Error(`AliExpress API error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('AliExpress API Error:', error);
      throw error;
    }
  }

  async syncInventory(products: Array<{
    sku: string;
    quantity: number;
  }>): Promise<SyncResult> {
    try {
      const response = await fetch(`${this.baseUrl}/inventory/batch`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ products })
      });

      if (!response.ok) {
        throw new Error(`Inventory sync failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Inventory sync error:', error);
      throw error;
    }
  }

  // Execute a generic API call (used for fulfillment, etc)
  async execute(apiName: string, params: Record<string, any>): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/topapi/${apiName}`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(params)
      });

      if (!response.ok) {
        throw new Error(`AliExpress execute error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('AliExpress execute error:', error);
      throw error;
    }
  }

  async convertToProduct(aliProduct: AliExpressProduct): Promise<IProductInput> {
    return {
      name: aliProduct.title,
      slug: aliProduct.title.toLowerCase().replace(/\s+/g, '-'),
      category: 'Imported',
      images: [], // Need to implement image handling
      brand: 'AliExpress',
      description: '',  // You can populate this if available from aliProduct.metadata
      isPublished: true,
      price: aliProduct.price,
      listPrice: aliProduct.price,
      countInStock: aliProduct.inventory,
      tags: ['aliexpress'],
      sizes: [],
      colors: [],
      avgRating: 0,
      numReviews: 0,
      discount: 0,
      weight: 0,
      dimensions: { length: 0, width: 0, height: 0 },
      warehouse: {
        provider: "4PX", // or "ShipBob", depending on your integration
        sku: aliProduct.id,
        availableQuantity: aliProduct.inventory,
        // Add additional warehouse-specific fields here if needed
      }
    };
  }
}
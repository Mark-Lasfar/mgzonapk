
export class ShopifyAPI {
    private config: {
      apiKey: string;
      password: string;
      storeDomain: string;
    };
  
    constructor(config: { apiKey: string; password: string; storeDomain: string }) {
      this.config = config;
    }
  
    async getProduct(productId: string): Promise<any> {
      const url = `https://${this.config.apiKey}:${this.config.password}@${this.config.storeDomain}/admin/api/2023-01/products/${productId}.json`;
  
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch product from Shopify: ${res.statusText}`);
      }
  
      const data = await res.json();
      return data.product;
    }
  }
  
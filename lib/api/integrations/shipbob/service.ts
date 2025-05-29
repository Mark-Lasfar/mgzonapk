import { ShipBobProduct, ShipBobOrder, ShipBobInventory } from './types';

export class ShipBobService {
  private apiKey: string;
  private apiUrl: string;

  constructor(config: { apiKey: string; apiUrl: string }) {
    this.apiKey = config.apiKey;
    this.apiUrl = config.apiUrl;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${this.apiUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`ShipBob API error: ${error.message || response.statusText}`);
    }

    return response.json();
  }

  async getInventoryLevels(productIds?: string[]) {
    const params = productIds ? `?product_ids=${productIds.join(',')}` : '';
    return this.request(`/inventory${params}`);
  }

  async createOrder(order: ShipBobOrder) {
    return this.request('/orders', {
      method: 'POST',
      body: JSON.stringify(order),
    });
  }

  async getOrder(orderId: string) {
    return this.request(`/orders/${orderId}`);
  }

  async getFulfillmentStatus(orderId: string) {
    return this.request(`/orders/${orderId}/fulfillment`);
  }

  async getWarehouses() {
    return this.request('/locations');
  }

  async getOptimalWarehouse(order: {
    shipping_address: {
      country: string;
      state: string;
      city: string;
      zip: string;
    };
    items: Array<{ product_id: string; quantity: number }>;
  }) {
    return this.request('/locations/optimal', {
      method: 'POST',
      body: JSON.stringify(order),
    });
  }

  async checkConnection() {
    return this.request('/health');
  }

  async updateInventory(productId: string, inventory: ShipBobInventory) {
    return this.request(`/inventory/${productId}`, {
      method: 'PUT',
      body: JSON.stringify(inventory),
    });
  }

  async cancelOrder(orderId: string) {
    return this.request(`/orders/${orderId}/cancel`, {
      method: 'POST',
    });
  }

  async getProducts() {
    return this.request('/products');
  }

  async getProduct(productId: string) {
    return this.request(`/products/${productId}`);
  }

  async createProduct(product: ShipBobProduct) {
    return this.request('/products', {
      method: 'POST',
      body: JSON.stringify(product),
    });
  }
}

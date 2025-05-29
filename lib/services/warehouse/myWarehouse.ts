import { WarehouseService } from './types';

export class MyWarehouseService implements WarehouseService {
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
      throw new Error(`MyWarehouse API error: ${error.message || response.statusText}`);
    }

    return response.json();
  }

  async getInventoryLevels(productIds?: string[]) {
    const params = productIds ? `?product_ids=${productIds.join(',')}` : '';
    return this.request(`/inventory${params}`);
  }

  async createOrder(order: any) {
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

  async getOptimalWarehouse(order: any) {
    return this.request('/locations/optimal', {
      method: 'POST',
      body: JSON.stringify(order),
    });
  }
}

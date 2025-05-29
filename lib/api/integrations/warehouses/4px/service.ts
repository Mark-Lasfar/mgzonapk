import { BaseIntegrationService } from '../../common/base-integration';
import { FourPXProduct, FourPXOrder, FourPXInventory } from './types';

export class FourPXService extends BaseIntegrationService {
  constructor(config: { apiKey: string; apiSecret: string; apiUrl: string; sandbox?: boolean }) {
    super({
      ...config,
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      apiUrl: config.apiUrl,
      sandbox: config.sandbox || false,
    });
  }

  async createOrder(order: FourPXOrder): Promise<any> {
    return this.request('/orders/create', {
      method: 'POST',
      data: { ...order, platformId: 'MGZON_001' },
    });
  }

  async getInventoryLevels(productIds?: string[]): Promise<any> {
    const params = productIds ? `?skus=${productIds.join(',')}` : '';
    return this.request(`/inventory/list${params}`);
  }

  async getOrder(orderId: string): Promise<any> {
    return this.request(`/orders/${orderId}`);
  }

  async getWarehouses(): Promise<any> {
    return this.request('/warehouses');
  }

  async createProduct(product: FourPXProduct): Promise<any> {
    return this.request('/products/create', {
      method: 'POST',
      data: { ...product, platformId: 'MGZON_001' },
    });
  }
}
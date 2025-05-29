import { BaseIntegrationService } from '../../common/base-integration';
import { AliExpressProduct, AliExpressOrder } from './types';

export class AliExpressService extends BaseIntegrationService {
  constructor(config: { apiKey: string; apiSecret: string; accessToken: string; apiUrl: string; sandbox?: boolean }) {
    super({
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      accessToken: config.accessToken,
      apiUrl: config.apiUrl,
      sandbox: config.sandbox || false,
    });
  }

  async createOrder(order: AliExpressOrder): Promise<any> {
    return this.request('/order/create', {
      method: 'POST',
      data: order,
    });
  }

  async getInventoryLevels(productIds?: string[]): Promise<any> {
    const params = productIds ? `?product_ids=${productIds.join(',')}` : '';
    return this.request(`/inventory/list${params}`);
  }

  async getOrder(orderId: string): Promise<any> {
    return this.request(`/order/${orderId}`);
  }

  async listProducts(): Promise<any> {
    return this.request('/products/list');
  }
}
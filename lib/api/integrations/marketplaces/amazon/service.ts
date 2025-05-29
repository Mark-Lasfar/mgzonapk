import { BaseIntegrationService } from '../../common/base-integration';
import { AmazonProduct, AmazonOrder } from './types';

export class AmazonService extends BaseIntegrationService {
  constructor(config: { accessToken: string; refreshToken: string; merchantId: string; apiUrl: string; sandbox?: boolean }) {
    super({
      apiKey: config.accessToken,
      apiUrl: config.apiUrl,
      sandbox: config.sandbox || false,
    });
    this.headers['X-Merchant-Id'] = config.merchantId;
  }

  async createOrder(order: AmazonOrder): Promise<any> {
    return this.request('/orders/v0/orders', {
      method: 'POST',
      data: order,
    });
  }

  async getInventoryLevels(productIds?: string[]): Promise<any> {
    const params = productIds ? `?skus=${productIds.join(',')}` : '';
    return this.request(`/fba/inventory/v1/summaries${params}`);
  }

  async getOrder(orderId: string): Promise<any> {
    return this.request(`/orders/v0/orders/${orderId}`);
  }

  async listProducts(): Promise<any> {
    return this.request('/products/v1/listings');
  }
}
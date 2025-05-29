import { FulfillmentOrder, FulfillmentConfig } from '../../types/fulfillment';
import { AliExpressClient } from './top-client';

export class AliExpressFulfillmentService {
  private client: AliExpressClient;

  constructor(config: FulfillmentConfig) {
    this.client = new AliExpressClient({
      apiKey: config.credentials.apiKey!,
      apiSecret: config.credentials.apiSecret!,
      accessToken: config.credentials.accessToken,
      sandbox: config.sandbox,
    });
  }

  async createFulfillmentOrder(order: FulfillmentOrder) {
    try {
      const response = await this.client.execute('aliexpress.trade.order.place', {
        logistics_address: {
          contact_person: `${order.shippingAddress.firstName} ${order.shippingAddress.lastName}`,
          address: order.shippingAddress.address1,
          address2: order.shippingAddress.address2,
          city: order.shippingAddress.city,
          province: order.shippingAddress.state,
          zip: order.shippingAddress.postalCode,
          country: order.shippingAddress.country,
          mobile_no: order.shippingAddress.phone,
        },
        product_items: order.items.map(item => ({
          product_id: item.sku,
          quantity: item.quantity,
          sku_attr: '',
        })),
        logistics_service_name: order.shippingMethod,
      });

      return {
        success: true,
        data: {
          orderId: response.order_id,
          status: 'processing',
        },
      };
    } catch (error: any) {
      throw new Error(`AliExpress fulfillment error: ${error?.message || error}`);
    }
  }

  async getFulfillmentOrder(orderId: string) {
    try {
      const response = await this.client.execute('aliexpress.trade.order.get', {
        order_id: orderId,
      });

      return {
        success: true,
        data: {
          status: response.order_status,
          trackingNumber: response.logistics_info?.tracking_number,
          updatedAt: response.gmt_modified,
        },
      };
    } catch (error: any) {
      throw new Error(`AliExpress tracking error: ${error?.message || error}`);
    }
  }
}
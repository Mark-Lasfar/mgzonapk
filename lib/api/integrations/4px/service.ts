import { FulfillmentOrder, FulfillmentConfig } from '../../types/fulfillment';
import { FourPXClient } from './4px-client';

export class FourPXFulfillmentService {
  private client: FourPXClient;

  constructor(config: FulfillmentConfig) {
    if (!config.apiKey || !config.apiSecret) {
      throw new Error('Missing API credentials for 4PX fulfillment service.');
    }

    this.client = new FourPXClient({
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      warehouseId: config.warehouseId,
    });
  }

  async createFulfillmentOrder(order: FulfillmentOrder) {
    try {
      if (!order.items.length) {
        throw new Error('Order must have at least one item.');
      }

      const response = await this.client.createOrder({
        ref_no: order.orderId,
        warehouse_code: this.client.defaultWarehouse,
        consignee_info: {
          name: order.shippingAddress.name || '',
          company: order.shippingAddress.company || '',
          address1: order.shippingAddress.street1 || '',
          address2: order.shippingAddress.street2 || '',
          city: order.shippingAddress.city,
          state: order.shippingAddress.state,
          country: order.shippingAddress.country,
          postcode: order.shippingAddress.postalCode,
          phone: order.shippingAddress.phone,
          email: order.shippingAddress.email || '',
        },
        shipping_method: order.shippingMethod,
        items: order.items.map(item => ({
          sku: item.sku,
          quantity: item.quantity,
        })),
      });

      return {
        success: true,
        data: {
          orderId: response.order_id,
          status: 'processing',
        },
      };
    } catch (error: any) {
      throw new Error(`4PX fulfillment error: ${error?.message || 'Unknown error'}`);
    }
  }

  async getFulfillmentOrder(orderId: string) {
    try {
      const response = await this.client.getOrder(orderId);

      return {
        success: true,
        data: {
          status: response.status,
          trackingNumber: response.tracking_number || '',
          carrier: response.carrier || '',
          updatedAt: response.update_time,
        },
      };
    } catch (error: any) {
      throw new Error(`4PX tracking error: ${error?.message || 'Unknown error'}`);
    }
  }
}

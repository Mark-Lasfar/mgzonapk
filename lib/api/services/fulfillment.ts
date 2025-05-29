import { ShipBobService } from '../integrations/shipbob/service';
import { AmazonFBAService } from '../integrations/amazon/service';
import { WebhookDispatcher } from '../webhook-dispatcher';
import Order from '@/lib/db/models/order.model';

export class FulfillmentService {
  private shipbob: ShipBobService;
  private amazonFBA: AmazonFBAService;

  constructor(config: {
    shipbob: {
      apiKey: string;
      apiUrl: string;
    };
    amazon: {
      region: string;
      refreshToken: string;
      accessKeyId: string;
      secretAccessKey: string;
      roleArn: string;
    };
    shopify?: {
      apiKey: string;
      apiSecret: string;
      domain: string;
      accessToken: string;
    };
  }) {
    this.shipbob = new ShipBobService(config.shipbob);
    this.amazonFBA = new AmazonFBAService(config.amazon);
  }

  async processOrder(orderId: string, options: {
    fulfillmentType: 'shipbob' | 'amazon' | 'shopify';
    priority?: 'standard' | 'expedited' | 'priority';
  }) {
    try {
      const order = await Order.findById(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      switch (options.fulfillmentType) {
        case 'amazon':
          return this.processAmazonFulfillment(order, options);
        case 'shipbob':
          return this.processShipBobFulfillment(order, options);
        case 'shopify':
          return this.processShopifyFulfillment(order, options);
        default:
          throw new Error('Invalid fulfillment type');
      }
    } catch (error) {
      console.error('Fulfillment process failed:', error);
      throw error;
    }
  }

  private async processAmazonFulfillment(order: any, options: any) {
    // Check inventory availability in Amazon FBA
    const inventory = await this.amazonFBA.getInventory(
      order.items.map((item: any) => item.sku)
    );

    if (!this.hasAvailableInventory(inventory, order.items)) {
      throw new Error('Insufficient inventory in Amazon FBA');
    }

    // Create Amazon FBA fulfillment order
    const amazonOrder = await this.amazonFBA.createFulfillmentOrder({
      amazonOrderId: order.id,
      sellerOrderId: order.id,
      fulfillmentAction: 'Ship',
      displayableOrderId: order.id,
      displayableOrderDate: new Date().toISOString(),
      shippingSpeedCategory: options.priority?.toUpperCase() || 'STANDARD',
      destinationAddress: order.shippingAddress,
      items: order.items.map((item: any) => ({
        sellerSku: item.sku,
        quantity: item.quantity
      }))
    });

    // Update order status
    await Order.findByIdAndUpdate(order.id, {
      fulfillmentStatus: 'processing',
      fulfillmentId: amazonOrder.fulfillmentOrderId,
      fulfillmentType: 'amazon'
    });

    // Dispatch webhook
    await WebhookDispatcher.dispatch(
      order.userId,
      'order.fulfillment.created',
      {
        orderId: order.id,
        fulfillmentId: amazonOrder.fulfillmentOrderId,
        fulfillmentType: 'amazon',
        status: 'processing'
      }
    );

    return {
      success: true,
      data: {
        fulfillmentId: amazonOrder.fulfillmentOrderId,
        status: 'processing',
        provider: 'amazon'
      }
    };
  }

  async trackFulfillment(fulfillmentId: string, options: {
    type: 'shipbob' | 'amazon' | 'shopify'
  }) {
    try {
      switch (options.type) {
        case 'amazon':
          const amazonStatus = await this.amazonFBA.getFulfillmentOrder(fulfillmentId);
          return {
            success: true,
            data: amazonStatus
          };
        case 'shipbob':
          return this.shipbob.getFulfillmentStatus(fulfillmentId);
        default:
          throw new Error('Invalid fulfillment type');
      }
    } catch (error) {
      console.error('Tracking update failed:', error);
      throw error;
    }
  }

  private hasAvailableInventory(inventory: any[], items: any[]) {
    return items.every(item => {
      const itemInventory = inventory.find(inv => 
        inv.sku === item.sku || inv.reference_id === item.productId
      );
      return itemInventory && itemInventory.availableQuantity >= item.quantity;
    });
  }
}
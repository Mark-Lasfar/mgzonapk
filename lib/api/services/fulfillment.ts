// import { aliexpressService } from '@/lib/api/integrations/aliexpress/service';
// import { AmazonFBAService } from '@/lib/api/integrations/amazon/service';
import { WebhookDispatcher } from '@/lib/api/webhook-dispatcher';
import { connectToDatabase } from '@/lib/db';
import Order from '@/lib/db/models/order.model';
import { logger } from '@/lib/api/services/logging';
import { AmazonService } from '../integrations/amazon/service';
import { AliExpressService } from '../integrations/marketplaces/aliexpress/service';

interface OrderItem {
  product: { _id: string; warehouseData: Array<{ sku: string; quantity: number }> };
  quantity: number;
}

interface OrderDocument {
  _id: string;
  userId: string;
  items: OrderItem[];
  shippingAddress: {
    fullName: string;
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    phone?: string;
  };
  fulfillmentStatus?: string;
  fulfillmentId?: string;
  fulfillmentType?: string;
}

export class FulfillmentService {
  private aliexpress: aliexpressService;

  private amazonFBA: AmazonFBAService;

  constructor(config: {
    aliexpress: { apiKey: string; apiUrl: string };
    amazon: {
      region: string;
      refreshToken: string;
      clientId: string;
      clientSecret: string;
      awsAccessKey: string;
      awsSecretKey: string;
      roleArn: string;
    };
    shopify?: { apiKey: string; apiSecret: string; domain: string; accessToken: string };
  }) {
    this.aliexpress = new AliExpressService(config.aliexpress);
    this.amazonFBA = new AmazonService(config.amazon);
  }

  async processOrder(
    orderId: string,
    options: { fulfillmentType: 'aliexpress' | 'amazon' | 'shopify'; priority?: 'standard' | 'expedited' }
  ) {
    try {
      await connectToDatabase();
      const order = await Order.findById(orderId).populate('items.product');
      if (!order) {
        throw new Error('Order not found');
      }

      switch (options.fulfillmentType) {
        case 'amazon':
          return this.processAmazonFulfillment(order as OrderDocument, options);
        case 'aliexpress':
          return this.processaliexpressFulfillment(order as OrderDocument, options);
        case 'shopify':
          return this.processShopifyFulfillment(order as OrderDocument, options);
        default:
          throw new Error('Invalid fulfillment type');
      }
    } catch (error) {
      logger.error('Fulfillment process failed', { orderId, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  private async processAmazonFulfillment(order: OrderDocument, options: { priority?: string }) {
    try {
      const inventory = await this.amazonFBA.getInventory(
        order.items.map((item) => item.product.warehouseData[0]?.sku).filter(Boolean)
      );

      if (!this.hasAvailableInventory(inventory, order.items)) {
        throw new Error('Insufficient inventory in Amazon FBA');
      }

      const amazonOrder = await this.amazonFBA.createFulfillmentOrder({
        orderId: order._id,
        shippingAddress: {
          name: order.shippingAddress.fullName,
          street1: order.shippingAddress.street,
          street2: '',
          city: order.shippingAddress.city,
          state: order.shippingAddress.state,
          postalCode: order.shippingAddress.postalCode,
          country: order.shippingAddress.country,
          phone: order.shippingAddress.phone,
        },
        items: order.items.map((item) => ({
          sku: item.product.warehouseData[0]?.sku,
          quantity: item.quantity,
        })),
        shippingMethod: options.priority || 'Standard',
      });

      await Order.findByIdAndUpdate(order._id, {
        fulfillmentStatus: 'processing',
        fulfillmentId: amazonOrder.data.fulfillmentOrderId,
        fulfillmentType: 'amazon',
        updatedAt: new Date(),
      });

      await WebhookDispatcher.dispatch(order.userId, 'order.fulfillment.created', {
        orderId: order._id,
        fulfillmentId: amazonOrder.data.fulfillmentOrderId,
        fulfillmentType: 'amazon',
        status: 'processing',
      });

      logger.info('Amazon fulfillment created', { orderId: order._id, fulfillmentId: amazonOrder.data.fulfillmentOrderId });

      return {
        success: true,
        data: {
          fulfillmentId: amazonOrder.data.fulfillmentOrderId,
          status: 'processing',
          provider: 'amazon',
        },
      };
    } catch (error) {
      logger.error('Amazon fulfillment error', { orderId: order._id, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  private async processaliexpressFulfillment(order: OrderDocument, options: { priority?: string }) {
    try {
      const items = order.items.map((item) => ({
        sku: item.product.warehouseData[0]?.sku,
        quantity: item.quantity,
        productId: item.product._id,
      }));

      const inventory = await this.aliexpress.getInventory(items.map((item) => item.sku).filter(Boolean));

      if (!this.hasAvailableInventory(inventory, items)) {
        throw new Error('Insufficient inventory in aliexpress');
      }

      const shipment = await this.aliexpress.createShipment({
        orderId: order._id,
        items,
        shippingAddress: {
          name: order.shippingAddress.fullName,
          street: order.shippingAddress.street,
          city: order.shippingAddress.city,
          state: order.shippingAddress.state,
          country: order.shippingAddress.country,
          postalCode: order.shippingAddress.postalCode,
          phone: order.shippingAddress.phone,
        },
        shippingMethod: options.priority || 'standard',
      });

      await Order.findByIdAndUpdate(order._id, {
        fulfillmentStatus: 'processing',
        fulfillmentId: shipment.trackingId,
        fulfillmentType: 'aliexpress',
        updatedAt: new Date(),
      });

      await WebhookDispatcher.dispatch(order.userId, 'order.fulfillment.created', {
        orderId: order._id,
        fulfillmentId: shipment.trackingId,
        fulfillmentType: 'aliexpress',
        status: 'processing',
      });

      logger.info('aliexpress fulfillment created', { orderId: order._id, fulfillmentId: shipment.trackingId });

      return {
        success: true,
        data: {
          fulfillmentId: shipment.trackingId,
          status: 'processing',
          provider: 'aliexpress',
        },
      };
    } catch (error) {
      logger.error('aliexpress fulfillment error', { orderId: order._id, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  private async processShopifyFulfillment(order: OrderDocument, options: { priority?: string }) {
    logger.warn('Shopify fulfillment not implemented', { orderId: order._id });
    throw new Error('Shopify fulfillment not implemented');
  }

  async trackFulfillment(fulfillmentId: string, options: { type: 'aliexpress' | 'amazon' | 'shopify' }) {
    try {
      switch (options.type) {
        case 'amazon':
          return await this.amazonFBA.getFulfillmentOrder(fulfillmentId);
        case 'aliexpress':
          return await this.aliexpress.getFulfillmentStatus(fulfillmentId);
        case 'shopify':
          throw new Error('Shopify fulfillment tracking not implemented');
        default:
          throw new Error('Invalid fulfillment type');
      }
    } catch (error) {
      logger.error('Tracking update failed', { fulfillmentId, error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }
// getFulfillmentService
  getFulfillmentService(provider: 'aliexpress' | 'amazon' | 'shopify') {
    switch (provider) {
      case 'aliexpress':
        return this.aliexpress;
      case 'amazon':
        return this.amazonFBA;
      case 'shopify':
        throw new Error('Shopify fulfillment service not implemented');
      default:
        throw new Error('Invalid fulfillment provider');
    }
  }
  private hasAvailableInventory(inventory: any[], items: any[]) {
    return items.every((item) => {
      const itemInventory = inventory.find((inv) => inv.sku === item.sku || inv.reference_id === item.productId);
      return itemInventory && itemInventory.availableQuantity >= item.quantity;
    });
  }
}
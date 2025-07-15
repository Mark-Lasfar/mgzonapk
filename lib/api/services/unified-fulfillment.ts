import { z } from 'zod';
import axios from 'axios';
import { logger } from './logging';
import { GenericIntegrationService } from './generic-integration';
import { PrometheusMetrics } from './metrics';
import { WebhookDispatcher } from '@/lib/api/webhook-dispatcher';
// import IOrder from '@/lib/db/models/order.model';
import SellerIntegration from '@/lib/db/models/seller-integration.model';
import Integration from '@/lib/db/models/integration.model';
import { Order } from '@/lib/db/models/order.model';

const metrics = new PrometheusMetrics();

const ShipmentSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  sellerId: z.string().min(1, 'Seller ID is required'),
  items: z.array(
    z.object({
      productId: z.string().min(1, 'Product ID is required'),
      sku: z.string().min(1, 'SKU is required'),
      quantity: z.number().min(1, 'Quantity must be at least 1'),
    })
  ).min(1, 'At least one item is required'),
  shippingAddress: z.object({
    name: z.string().min(1, 'Name is required'),
    street: z.string().min(1, 'Street is required'),
    city: z.string().min(1, 'City is required'),
    state: z.string().optional(),
    country: z.string().min(2, 'Country is required'),
    postalCode: z.string().min(1, 'Postal code is required'),
    phone: z.string().optional(),
  }),
  shippingMethod: z.enum(['standard', 'expedited', 'priority']).optional().default('standard'),
  providerName: z.string().min(1, 'Provider name is required'),
});

const WebhookSchema = z.object({
  eventType: z.string().min(1, 'Event type is required'),
  orderId: z.string().min(1, 'Order ID is required'),
  userId: z.string().min(1, 'User ID is required'),
  status: z.string().optional(),
});

export class UnifiedFulfillmentService {
  private metrics: PrometheusMetrics;

  constructor() {
    this.metrics = new PrometheusMetrics();
  }

  async createShipment(data: unknown) {
    try {
      const validatedData = ShipmentSchema.parse(data);
      const { orderId, sellerId, items, shippingAddress, shippingMethod, providerName } = validatedData;

      // جلب إعدادات التكامل
      const integration = await Integration.findOne({ providerName, isActive: true });
      if (!integration) {
        throw new Error(`Integration not found: ${providerName}`);
      }
      const sellerIntegration = await SellerIntegration.findOne({
        sellerId,
        integrationId: integration._id,
        isActive: true,
      });
      if (!sellerIntegration) {
        throw new Error(`Seller integration not connected: ${providerName}`);
      }

      // إنشاء GenericIntegrationService
      const service = new GenericIntegrationService(integration, sellerIntegration);

      // بناء الـ payload
      const payload = {
        reference_id: orderId,
        order_number: orderId,
        shipping_method: shippingMethod || 'Standard',
        recipient: {
          name: shippingAddress.name,
          address: {
            address1: shippingAddress.street,
            city: shippingAddress.city,
            state: shippingAddress.state,
            country: shippingAddress.country,
            zip_code: shippingAddress.postalCode,
          },
          phone: shippingAddress.phone,
        },
        products: items.map((item) => ({
          reference_id: item.productId,
          quantity: item.quantity,
        })),
      };

      // إرسال طلب إنشاء شحنة
      const response = await service.callApi({
        endpoint: integration.settings.endpoints?.createShipment || '/shipments',
        method: 'POST',
        body: payload,
      });

      // تحديث الطلب
      await Order.findByIdAndUpdate(orderId, {
        fulfillmentStatus: response.status || 'processing',
        fulfillmentId: response.fulfillmentId,
        fulfillmentType: providerName.toLowerCase(),
        updatedAt: new Date(),
      });

      // إرسال webhook
      await WebhookDispatcher.dispatch(sellerId, 'order.fulfillment.created', {
        orderId,
        fulfillmentId: response.fulfillmentId,
        fulfillmentType: providerName.toLowerCase(),
        status: response.status || 'processing',
      });

      const shipment = {
        id: response.fulfillmentId,
        provider: providerName,
        trackingNumber: response.trackingNumber,
        status: response.status || 'processing',
        ...validatedData,
      };

      await this.metrics.recordMetric({
        name: 'shipment.created',
        value: 1,
        timestamp: new Date(),
        tags: { provider: providerName },
      });

      logger.info('Shipment created', {
        shipmentId: shipment.id,
        provider: providerName,
        timestamp: new Date().toISOString(),
      });

      return shipment;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.metrics.recordError({
        error: errorMessage,
        context: { data },
        timestamp: new Date(),
      });
      logger.error('Create shipment error', {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      });
      throw new Error(`Failed to create shipment: ${errorMessage}`);
    }
  }

  async trackShipment(shipmentId: string, providerName: string) {
    try {
      const integration = await Integration.findOne({ providerName, isActive: true });
      if (!integration) {
        throw new Error(`Integration not found: ${providerName}`);
      }
      const sellerIntegration = await SellerIntegration.findOne({
        integrationId: integration._id,
        isActive: true,
      });
      if (!sellerIntegration) {
        throw new Error(`Seller integration not connected: ${providerName}`);
      }

      const service = new GenericIntegrationService(integration, sellerIntegration);
      const response = await service.callApi({
        endpoint: integration.settings.endpoints?.trackShipment || `/shipments/${shipmentId}`,
        method: 'GET',
      });

      const tracking = {
        shipmentId,
        status: response.status || 'in_transit',
        lastUpdated: new Date(),
        trackingNumber: response.trackingNumber,
      };

      await this.metrics.recordMetric({
        name: 'shipment.tracked',
        value: 1,
        timestamp: new Date(),
      });

      return tracking;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.metrics.recordError({
        error: errorMessage,
        context: { shipmentId, providerName },
        timestamp: new Date(),
      });
      logger.error('Track shipment error', {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      });
      throw new Error(`Failed to track shipment: ${errorMessage}`);
    }
  }

  async handleWebhook(providerName: string, payload: unknown) {
    try {
      const validatedPayload = WebhookSchema.parse(payload);
      const { orderId, eventType, status } = validatedPayload;

      const integration = await Integration.findOne({ providerName, isActive: true });
      if (!integration) {
        throw new Error(`Integration not found: ${providerName}`);
      }

      await Order.findByIdAndUpdate(orderId, {
        fulfillmentStatus: status || 'pending',
        updatedAt: new Date(),
      });

      await this.metrics.recordMetric({
        name: 'webhook.processed',
        value: 1,
        timestamp: new Date(),
        tags: { provider: providerName, eventType },
      });

      logger.info('Webhook processed', {
        provider: providerName,
        orderId,
        eventType,
        timestamp: new Date().toISOString(),
      });

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.metrics.recordError({
        error: errorMessage,
        context: { provider: providerName, payload },
        timestamp: new Date(),
      });
      logger.error('Webhook handling error', {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      });
      throw new Error(`Failed to handle webhook: ${errorMessage}`);
    }
  }
}
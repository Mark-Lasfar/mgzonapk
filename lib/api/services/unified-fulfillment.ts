import { z } from 'zod';
import { logger } from './logging';
import { ObservabilityService } from './observability';

const ShipmentSchema = z.object({
  orderId: z.string(),
  sellerId: z.string(),
  items: z.array(
    z.object({
      productId: z.string(),
      quantity: z.number().min(1),
    })
  ),
  shippingAddress: z.object({
    street: z.string(),
    city: z.string(),
    state: z.string(),
    country: z.string(),
    postalCode: z.string(),
  }),
});

export class UnifiedFulfillmentService {
  private observabilityService: ObservabilityService;

  constructor() {
    this.observabilityService = ObservabilityService.getInstance();
  }

  async createShipment(data: unknown) {
    try {
      const validatedData = ShipmentSchema.parse(data);
      const shipment = {
        id: `ship_${Date.now()}`,
        provider: 'example',
        trackingNumber: `TRK${Math.random().toString(36).substring(2, 15)}`,
        status: 'pending',
        ...validatedData,
      };

      await this.observabilityService.recordMetric({
        name: 'shipment.created',
        value: 1,
        timestamp: new Date(),
      });

      logger.info('Shipment created', {
        shipmentId: shipment.id,
        timestamp: new Date().toISOString(),
      });

      return shipment;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.observabilityService.recordError({
        error: errorMessage,
        context: { data },
        timestamp: new Date(),
      });
      logger.error('Create shipment error', {
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
      throw new Error('Failed to create shipment');
    }
  }

  async trackShipment(shipmentId: string) {
    try {
      const tracking = {
        shipmentId,
        status: 'in_transit',
        lastUpdated: new Date(),
      };

      await this.observabilityService.recordMetric({
        name: 'shipment.tracked',
        value: 1,
        timestamp: new Date(),
      });

      return tracking;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.observabilityService.recordError({
        error: errorMessage,
        context: { shipmentId },
        timestamp: new Date(),
      });
      logger.error('Track shipment error', {
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
      throw new Error('Failed to track shipment');
    }
  }
}
import {
  WarehouseProvider,
  CreateShipmentRequest,
  ShipmentResponse,
  ShipmentStatus,
  WarehouseProduct,
  CreateProductRequest,
  UpdateProductRequest
} from './types';
import { logger } from '@/lib/api/services/logging';

export class ShipBobService implements WarehouseProvider {
  private baseUrl: string = 'https://api.shipbob.com/2.0';
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private channelId: string;
  private accessToken?: string;

  constructor(config: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    channelId: string;
    accessToken?: string;
  }) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;
    this.channelId = config.channelId;
    this.accessToken = config.accessToken;
  }

  name = 'ShipBob';

  private async getAccessToken(): Promise<string> {
    if (!this.accessToken) {
      throw new Error('Access token not available. Please authenticate first.');
    }
    return this.accessToken;
  }

  private async fetchApi(endpoint: string, options: RequestInit = {}) {
    try {
      const token = await this.getAccessToken();
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          shipbob_channel_id: this.channelId,
          ...options.headers,
        },
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`ShipBob API error: ${response.status} ${text}`);
      }

      return response.json();
    } catch (error) {
      logger.error('ShipBob API request failed', { endpoint, error });
      throw error;
    }
  }

  async createProduct(request: CreateProductRequest): Promise<{ id: string }> {
    try {
      const response = await this.fetchApi('/product', {
        method: 'POST',
        body: JSON.stringify({
          reference_id: request.sku,
          name: request.name,
          sku: request.sku,
          description: request.description,
          dimensions: request.dimensions,
          weight: request.weight,
        }),
      });
      return { id: response.id?.toString() };
    } catch (error) {
      logger.error('ShipBob create product failed', { error, sku: request.sku });
      throw error;
    }
  }

  async updateProduct(request: UpdateProductRequest): Promise<void> {
    try {
      await this.fetchApi(`/product/${request.externalId}`, {
        method: 'PUT',
        body: JSON.stringify({
          reference_id: request.sku,
          name: request.name,
          sku: request.sku,
          description: request.description,
          dimensions: request.dimensions,
          weight: request.weight,
          quantity: request.quantity,
        }),
      });
    } catch (error) {
      logger.error('ShipBob update product failed', { error, sku: request.sku });
      throw new Error('updateProduct not fully supported by ShipBob API');
    }
  }

  async deleteProduct(request: { externalId: string }): Promise<void> {
    try {
      await this.fetchApi(`/product/${request.externalId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      logger.error('ShipBob delete product failed', { error, externalId: request.externalId });
      throw error;
    }
  }

  async createShipment(request: CreateShipmentRequest): Promise<ShipmentResponse> {
    try {
      const response = await this.fetchApi('/order', {
        method: 'POST',
        body: JSON.stringify({
          reference_id: request.orderId,
          order_number: request.orderId,
          type: 'DTC',
          shipping_method: request.shippingMethod || 'Standard',
          recipient: {
            name: request.shippingAddress.name,
            address: {
              address1: request.shippingAddress.street,
              city: request.shippingAddress.city,
              state: request.shippingAddress.state,
              country: request.shippingAddress.country,
              zip_code: request.shippingAddress.postalCode,
            },
            phone_number: request.shippingAddress.phone,
          },
          products: request.items.map((item) => ({
            name: item.sku,
            reference_id: item.productId,
            quantity: item.quantity,
          })),
        }),
      });
      return { trackingId: response.id?.toString() };
    } catch (error) {
      logger.error('ShipBob create shipment failed', { error, orderId: request.orderId });
      throw error;
    }
  }

  async getShipmentStatus(shipmentId: string): Promise<ShipmentStatus> {
    try {
      const response = await this.fetchApi(`/shipment/${shipmentId}`);
      return {
        trackingId: response.tracking?.tracking_number || shipmentId,
        orderId: response.order_id,
        carrier: response.carrier,
        service: response.service,
        trackingUrl: response.tracking?.tracking_url,
        fulfillmentId: response.fulfillment_id,
        status: this.mapShipmentStatus(response.status),
        estimatedDeliveryDate: response.estimated_delivery_date
          ? new Date(response.estimated_delivery_date)
          : undefined,
        location: response.current_location,
        trackingEvents: response.tracking?.events || [],
        events: (response.tracking_events || []).map((event: any) => ({
          date: new Date(event.timestamp),
          status: event.status,
          location: event.location,
        })),
      };
    } catch (error) {
      logger.error('ShipBob get shipment status failed', { error, shipmentId });
      throw error;
    }
  }

  async getInventory(productId: string): Promise<WarehouseProduct> {
    try {
      const response = await this.fetchApi(`/inventory?product_id=${productId}`);
      if (!Array.isArray(response) || response.length === 0) {
        throw new Error(`Inventory for product_id ${productId} not found`);
      }
      const inventoryItem = response[0];
      return {
        id: productId,
        sku: inventoryItem.sku ?? 'Unknown SKU',
        name: inventoryItem.product_name ?? 'Unknown Product Name',
        quantity: inventoryItem.on_hand_quantity ?? 0,
        location: inventoryItem.warehouse_location ?? 'Unknown Location',
      };
    } catch (error) {
      logger.error('ShipBob get inventory failed', { error, productId });
      throw error;
    }
  }

  async updateInventory(productId: string, quantity: number): Promise<void> {
    logger.warn('ShipBob direct inventory updates not supported', { productId });
    throw new Error('Direct inventory updates not supported. Use warehouse receiving orders instead.');
  }

  private mapShipmentStatus(status: string): ShipmentStatus['status'] {
    switch (status.toLowerCase()) {
      case 'in_transit':
        return 'shipped';
      case 'delivered':
        return 'delivered';
      case 'processing':
        return 'processing';
      case 'cancelled':
        return 'cancelled';
      case 'exception':
        return 'exception';
      case 'onhold':
        return 'onhold';
      default:
        return 'pending';
    }
  }
}
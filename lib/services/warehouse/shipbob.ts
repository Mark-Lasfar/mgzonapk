import { WarehouseProvider, CreateShipmentRequest, ShipmentResponse, ShipmentStatus, WarehouseProduct } from './types';

export class ShipBobService implements WarehouseProvider {
  private apiKey: string;
  private apiUrl: string;

  constructor(config: { apiKey: string; apiUrl: string }) {
    this.apiKey = config.apiKey;
    this.apiUrl = config.apiUrl;
  }

  name = 'ShipBob';

  private async fetchApi(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${this.apiUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`ShipBob API error: ${response.statusText}`);
    }

    return response.json();
  }

  async createShipment(request: CreateShipmentRequest): Promise<ShipmentResponse> {
    const response = await this.fetchApi('/shipments', {
      method: 'POST',
      body: JSON.stringify({
        reference_id: request.orderId,
        to_address: {
          name: request.shippingAddress.name,
          address1: request.shippingAddress.street,
          city: request.shippingAddress.city,
          state: request.shippingAddress.state,
          country: request.shippingAddress.country,
          zip: request.shippingAddress.postalCode,
          phone: request.shippingAddress.phone,
        },
        items: request.items.map(item => ({
          reference_id: item.productId,
          sku: item.sku,
          quantity: item.quantity,
        })),
      }),
    });

    return { trackingId: response.tracking_number };
  }

  async getShipmentStatus(trackingId: string): Promise<ShipmentStatus> {
    const response = await this.fetchApi(`/shipments/${trackingId}/tracking`);

    return {
      trackingId,
      status: this.mapShipmentStatus(response.status),
      estimatedDeliveryDate: new Date(response.estimated_delivery_date),
      location: response.current_location,
      events: response.tracking_events.map((event: any) => ({
        date: new Date(event.timestamp),
        status: event.status,
        location: event.location,
      })),
    };
  }

  async getInventory(productId: string): Promise<WarehouseProduct> {
    const response = await this.fetchApi(`/inventory/${productId}`);

    return {
      id: productId,
      sku: response.sku,
      name: response.product_name,
      quantity: response.on_hand_quantity,
      location: response.warehouse_location,
    };
  }

  async updateInventory(productId: string, quantity: number): Promise<void> {
    await this.fetchApi(`/inventory/${productId}`, {
      method: 'PUT',
      body: JSON.stringify({
        quantity,
      }),
    });
  }

  private mapShipmentStatus(status: string): ShipmentStatus['status'] {
    switch (status.toLowerCase()) {
      case 'in_transit':
        return 'shipped';
      case 'delivered':
        return 'delivered';
      case 'processing':
        return 'processing';
      default:
        return 'pending';
    }
  }
}
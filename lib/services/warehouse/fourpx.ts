import { WarehouseProvider, CreateShipmentRequest, ShipmentResponse, ShipmentStatus, WarehouseProduct } from './types';

export class FourPXService implements WarehouseProvider {
  private apiKey: string;
  private apiUrl: string;

  constructor(config: { apiKey: string; apiUrl: string }) {
    this.apiKey = config.apiKey;
    this.apiUrl = config.apiUrl;
  }

  name = '4PX';

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
      throw new Error(`4PX API error: ${response.statusText}`);
    }

    return response.json();
  }

  async createShipment(request: CreateShipmentRequest): Promise<ShipmentResponse> {
    const response = await this.fetchApi('/api/fulfillment/create', {
      method: 'POST',
      body: JSON.stringify({
        order_number: request.orderId,
        consignee: {
          name: request.shippingAddress.name,
          address: request.shippingAddress.street,
          city: request.shippingAddress.city,
          state: request.shippingAddress.state,
          country: request.shippingAddress.country,
          postcode: request.shippingAddress.postalCode,
          phone: request.shippingAddress.phone,
        },
        items: request.items.map(item => ({
          sku: item.sku,
          quantity: item.quantity,
        })),
      }),
    });

    return { 
      trackingId: response.tracking_number,
    };
  }

  async getShipmentStatus(trackingId: string): Promise<ShipmentStatus> {
    const response = await this.fetchApi(`/api/tracking/${trackingId}`);

    return {
      trackingId,
      status: this.mapShipmentStatus(response.status),
      estimatedDeliveryDate: response.estimated_delivery_date ? new Date(response.estimated_delivery_date) : undefined,
      location: response.current_location,
      events: response.tracking_details.map((event: any) => ({
        date: new Date(event.datetime),
        status: event.status,
        location: event.location,
      })),
    };
  }

  async getInventory(productId: string): Promise<WarehouseProduct> {
    const response = await this.fetchApi(`/api/inventory/${productId}`);

    return {
      id: productId,
      sku: response.sku,
      name: response.product_name,
      quantity: response.available_quantity,
      location: response.warehouse_location,
    };
  }

  async updateInventory(productId: string, quantity: number): Promise<void> {
    await this.fetchApi(`/api/inventory/update`, {
      method: 'POST',
      body: JSON.stringify({
        sku: productId,
        quantity: quantity,
      }),
    });
  }

  private mapShipmentStatus(status: string): ShipmentStatus['status'] {
    switch (status.toLowerCase()) {
      case 'in_transit':
      case 'shipping':
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
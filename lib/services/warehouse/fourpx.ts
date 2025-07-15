import { WarehouseProvider, CreateShipmentRequest, ShipmentResponse, ShipmentStatus, WarehouseProduct, CreateProductRequest, UpdateProductRequest } from './types';

export class FourPXService implements WarehouseProvider {
  private apiKey: string;
  private apiUrl: string;
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor(config: { apiKey: string; apiUrl: string; clientId: string; clientSecret: string; redirectUri: string }) {
    this.apiKey = config.apiKey;
    this.apiUrl = config.apiUrl;
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;
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

  async createProduct(request: CreateProductRequest): Promise<{ id: string }> {
    const response = await this.fetchApi('/api/product/create', {
      method: 'POST',
      body: JSON.stringify({
        sku: request.sku,
        name: request.name,
        description: request.description,
        dimensions: request.dimensions,
        weight: request.weight,
      }),
    });

    return { id: response.product_id };
  }

  async updateProduct(data: UpdateProductRequest): Promise<void> {
    await this.fetchApi(`/api/product/update/${data.externalId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        sku: data.sku,
        name: data.name,
        description: data.description,
        quantity: data.quantity,
        dimensions: data.dimensions,
        weight: data.weight,
        price: data.price,
        images: data.images,
      }),
    });
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

    return { trackingId: response.tracking_number };
  }

  async getShipmentStatus(trackingId: string): Promise<ShipmentStatus> {
    const response = await this.fetchApi(`/api/tracking/${trackingId}`);

    return {
      trackingId,
      status: this.mapShipmentStatus(response.status),
      estimatedDeliveryDate: response.estimated_delivery_date ? new Date(response.estimated_delivery_date) : undefined,
      location: response.current_location, // Fixed the typo
      events: response.tracking_details.map((event: any) => ({
        date: new Date(event.datetime),
        status: event.status,
        location: event.location,
      })),
      orderId: response.order_id,
      service: response.service || '4PX',
      fulfillmentId: response.fulfillment_id || trackingId,
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
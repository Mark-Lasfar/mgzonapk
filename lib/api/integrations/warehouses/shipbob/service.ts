import { BaseIntegrationService } from '@/lib/api/integrations/base/service';

interface ShipBobConfig {
  apiKey: string;
  apiUrl: string;
}

interface ProductData {
  sku: string;
  name: string;
  quantity: number;
  location?: string;
}

interface OrderData {
  orderId: string;
  items: { sku: string; quantity: number }[];
  shippingAddress: {
    name: string;
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
  shippingMethod: string;
  platformId: string;
}

interface UpdateProductStatusData {
  id: string;
  status: 'enabled' | 'disabled';
}

export class ShipBobService extends BaseIntegrationService {
  private apiKey: string;
  private apiUrl: string;

  constructor(config: ShipBobConfig) {
    super();
    this.apiKey = config.apiKey;
    this.apiUrl = config.apiUrl;
  }

  async createProduct(data: ProductData): Promise<{ id: string }> {
    try {
      const response = await fetch(`${this.apiUrl}/v1/products`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reference_id: data.sku,
          name: data.name,
          inventory: {
            quantity: data.quantity,
            location: data.location,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`ShipBob API error: ${response.statusText}`);
      }

      const result = await response.json();
      return { id: result.id };
    } catch (error) {
      throw new Error(`Failed to create product: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateProductStatus(data: UpdateProductStatusData): Promise<void> {
    try {
      const response = await fetch(`${this.apiUrl}/v1/products/${data.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: data.status,
        }),
      });

      if (!response.ok) {
        throw new Error(`ShipBob API error: ${response.statusText}`);
      }
    } catch (error) {
      throw new Error(`Failed to update product status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createOrder(data: OrderData): Promise<any> {
    try {
      const response = await fetch(`${this.apiUrl}/v1/orders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          order_id: data.orderId,
          platform_id: data.platformId,
          shipping_method: data.shippingMethod,
          recipient: {
            name: data.shippingAddress.name,
            address: {
              address1: data.shippingAddress.street,
              city: data.shippingAddress.city,
              state: data.shippingAddress.state,
              country: data.shippingAddress.country,
              zip_code: data.shippingAddress.postalCode,
            },
          },
          line_items: data.items.map(item => ({
            reference_id: item.sku,
            quantity: item.quantity,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`ShipBob API error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Failed to create order: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getOrder(orderId: string): Promise<any> {
    try {
      const response = await fetch(`${this.apiUrl}/v1/orders/${orderId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`ShipBob API error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Failed to get order: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getWarehouses(): Promise<any[]> {
    try {
      const response = await fetch(`${this.apiUrl}/v1/warehouses`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`ShipBob API error: ${response.statusText}`);
      }

      const result = await response.json();
      return result.map((wh: any) => ({
        id: wh.id,
        name: wh.name,
        location: `${wh.address.city}, ${wh.address.state}`,
        costPerUnit: wh.cost_per_unit || 1.0,
        supportedProducts: wh.supported_products || ['all'],
      }));
    } catch (error) {
      throw new Error(`Failed to get warehouses: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
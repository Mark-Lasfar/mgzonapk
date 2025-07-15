import axios from 'axios';
import { logger } from '@/lib/api/services/logging';
import {
  WarehouseProvider,
  CreateShipmentRequest,
  ShipmentResponse,
  ShipmentStatus,
  WarehouseProduct,
  CreateProductRequest,
  UpdateProductRequest,
  DeleteProductRequest,
} from '@/lib/services/warehouse/types';
import Seller from '@/lib/db/models/seller.model';

export class ShipHeroService implements WarehouseProvider {
  private baseUrl: string;
  private clientId: string;
  private clientSecret: string;
  private sellerId: string;
  private accessToken?: string;
  private refreshToken?: string;
  private tokenExpiresAt?: Date;

  constructor(config: {
    clientId: string;
    clientSecret: string;
    sellerId: string;
    apiUrl?: string;
  }) {
    this.baseUrl = config.apiUrl || 'https://public-api.shiphero.com';
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.sellerId = config.sellerId;
  }

  name = 'ShipHero';

  private async loadTokens(): Promise<void> {
    const seller = await Seller.findOne({ userId: this.sellerId }).select('shiphero');
    if (!seller?.shiphero) {
      throw new Error('ShipHero integration not found for seller');
    }
    this.accessToken = seller.shiphero.accessToken;
    this.refreshToken = seller.shiphero.refreshToken;
    this.tokenExpiresAt = seller.shiphero.expiresAt;
  }

  private async saveTokens(
    accessToken: string,
    refreshToken: string,
    expiresIn: number,
  ): Promise<void> {
    await Seller.updateOne(
      { userId: this.sellerId },
      {
        $set: {
          'shiphero.accessToken': accessToken,
          'shiphero.refreshToken': refreshToken,
          'shiphero.expiresAt': new Date(Date.now() + expiresIn * 1000),
          'shiphero.lastUpdatedAt': new Date(),
        },
      },
    );
  }

  private async authenticate(): Promise<void> {
    try {
      await this.loadTokens();
      if (
        this.accessToken &&
        this.tokenExpiresAt &&
        this.tokenExpiresAt > new Date()
      ) {
        return;
      }

      if (this.refreshToken) {
        await this.refreshAccessToken();
        return;
      }

      throw new Error('No valid tokens available');
    } catch (error) {
      logger.error('ShipHero authentication failed', { error, sellerId: this.sellerId });
      throw new Error('Failed to authenticate with ShipHero');
    }
  }

  private async refreshAccessToken(): Promise<void> {
    try {
      const response = await axios.post(`${this.baseUrl}/auth/refresh`, {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken,
      });

      const { access_token, refresh_token, expires_in } = response.data;
      this.accessToken = access_token;
      this.refreshToken = refresh_token;
      this.tokenExpiresAt = new Date(Date.now() + expires_in * 1000);

      await this.saveTokens(access_token, refresh_token, expires_in);
    } catch (error) {
      logger.error('ShipHero token refresh failed', { error, sellerId: this.sellerId });
      throw new Error('Failed to refresh ShipHero token');
    }
  }

  private async getHeaders(): Promise<Record<string, string>> {
    await this.authenticate();
    return {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  async createProduct(data: CreateProductRequest): Promise<{ id: string }> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.post(
        `${this.baseUrl}/graphql`,
        {
          query: `
            mutation CreateProduct($input: ProductCreateInput!) {
              product_create(data: $input) {
                product {
                  id
                  sku
                }
              }
            }
          `,
          variables: {
            input: {
              sku: data.sku,
              name: data.name,
              description: data.description || '',
              dimensions: data.dimensions || null,
              weight: data.weight || 0,
            },
          },
        },
        { headers },
      );

      const product = response.data.data?.product_create?.product;
      if (!product?.id) {
        throw new Error('Failed to create product: Invalid response');
      }

      return { id: product.id };
    } catch (error) {
      logger.error('ShipHero create product failed', {
        error,
        sellerId: this.sellerId,
        sku: data.sku,
      });
      throw error;
    }
  }

  async updateProduct(data: UpdateProductRequest): Promise<void> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.post(
        `${this.baseUrl}/graphql`,
        {
          query: `
            mutation UpdateProduct($id: ID!, $input: ProductUpdateInput!) {
              product_update(id: $id, data: $input) {
                product {
                  id
                }
              }
            }
          `,
          variables: {
            id: data.externalId,
            input: {
              sku: data.sku,
              name: data.name,
              description: data.description || '',
              quantity: data.quantity,
              dimensions: data.dimensions || null,
              weight: data.weight || 0,
            },
          },
        },
        { headers },
      );

      if (!response.data.data?.product_update?.product?.id) {
        throw new Error('Failed to update product: Invalid response');
      }
    } catch (error) {
      logger.error('ShipHero update product failed', {
        error,
        sellerId: this.sellerId,
        externalId: data.externalId,
      });
      throw error;
    }
  }

  async deleteProduct(data: DeleteProductRequest): Promise<void> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.post(
        `${this.baseUrl}/graphql`,
        {
          query: `
            mutation DeleteProduct($id: ID!) {
              product_delete(id: $id) {
                success
              }
            }
          `,
          variables: {
            id: data.externalId,
          },
        },
        { headers },
      );

      if (!response.data.data?.product_delete?.success) {
        throw new Error('Failed to delete product: Invalid response');
      }
    } catch (error) {
      logger.error('ShipHero delete product failed', {
        error,
        sellerId: this.sellerId,
        externalId: data.externalId,
      });
      throw error;
    }
  }

  async createShipment(request: CreateShipmentRequest): Promise<ShipmentResponse> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.post(
        `${this.baseUrl}/graphql`,
        {
          query: `
            mutation CreateOrder($input: OrderCreateInput!) {
              order_create(data: $input) {
                request_id
                order {
                  id
                  order_number
                }
              }
            }
          `,
          variables: {
            input: {
              order_number: request.orderId,
              items: request.items.map((item) => ({
                sku: item.sku,
                quantity: item.quantity,
              })),
              shipping_address: {
                first_name: request.shippingAddress.name.split(' ')[0] || '',
                last_name: request.shippingAddress.name.split(' ').slice(1).join(' ') || '',
                address1: request.shippingAddress.street,
                city: request.shippingAddress.city,
                state: request.shippingAddress.state,
                zip: request.shippingAddress.postalCode,
                country: request.shippingAddress.country,
                phone: request.shippingAddress.phone || '',
              },
              shipping_method: 'standard',
            },
          },
        },
        { headers },
      );

      const order = response.data.data?.order_create?.order;
      if (!order?.id) {
        throw new Error('Failed to create shipment: Invalid response');
      }

      return { trackingId: order.id };
    } catch (error) {
      logger.error('ShipHero create shipment failed', {
        error,
        sellerId: this.sellerId,
        orderId: request.orderId,
      });
      throw error;
    }
  }

  async getShipmentStatus(trackingId: string): Promise<ShipmentStatus> {
    try {
      const headers = await this.getHeaders();
      interface ShipHeroOrderResponse {
        data: {
          order?: {
            id: string;
            status: string;
            shipping_method: string;
            tracking_number: string;
            tracking_url: string;
            created_at: string;
            updated_at: string;
          };
        };
      }
      
      const response = await axios.post<ShipHeroOrderResponse>(
        `${this.baseUrl}/graphql`,
        {
          query: `
            query GetOrder($id: ID!) {
              order(id: $id) {
                id
                status
                shipping_method
                tracking_number
                tracking_url
                created_at
                updated_at
              }
            }
          `,
          variables: { id: trackingId },
        },
        { headers },
      );

      const order = response.data.data?.order;
      if (!order) {
        throw new Error('Order not found');
      }

      const mapStatus = (status: string): "pending" | "processing" | "shipped" | "delivered" | "cancelled" | "exception" | "onhold" => {
        switch (status?.toLowerCase()) {
          case 'shipped': return 'shipped';
          case 'delivered': return 'delivered';
          case 'cancelled': return 'cancelled';
          case 'processing': return 'processing';
          case 'exception': return 'exception';
          case 'onhold': return 'onhold';
          default: return 'pending';
        }
      };

      return {
        trackingId: order.id,
        status: mapStatus(order.status),
        carrier: order.shipping_method || 'unknown',
        trackingUrl: order.tracking_url || undefined,
        lastUpdated: order.updated_at ? new Date(order.updated_at).toISOString() : new Date().toISOString(),
      };
    } catch (error) {
      logger.error('ShipHero get shipment status failed', {
        error,
        sellerId: this.sellerId,
        trackingId,
      });
      throw error;
    }
  }

  async getInventory(sku: string): Promise<WarehouseProduct> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.post(
        `${this.baseUrl}/graphql`,
        {
          query: `
            query GetProduct($sku: String!) {
              product(sku: $sku) {
                id
                sku
                name
                warehouse_products {
                  quantity
                  warehouse_id
                }
              }
            }
          `,
          variables: { sku },
        },
        { headers },
      );

      const product = response.data.data?.product;
      if (!product) {
        throw new Error('Product not found');
      }

      return {
        id: product.id,
        sku: product.sku,
        name: product.name,
        quantity: product.warehouse_products?.[0]?.quantity || 0,
        location: product.warehouse_products?.[0]?.warehouse_id || 'unknown',
      };
    } catch (error) {
      logger.error('ShipHero get inventory failed', {
        error,
        sellerId: this.sellerId,
        sku,
      });
      throw error;
    }
  }

  async updateInventory(sku: string, quantity: number): Promise<void> {
    try {
      const headers = await this.getHeaders();
      const response = await axios.post(
        `${this.baseUrl}/graphql`,
        {
          query: `
            mutation UpdateInventory($input: InventoryUpdateInput!) {
              inventory_update(data: $input) {
                inventory {
                  sku
                  quantity
                }
              }
            }
          `,
          variables: {
            input: {
              sku,
              quantity,
            },
          },
        },
        { headers },
      );

      if (!response.data.data?.inventory_update?.inventory) {
        throw new Error('Failed to update inventory: Invalid response');
      }
    } catch (error) {
      logger.error('ShipHero update inventory failed', {
        error,
        sellerId: this.sellerId,
        sku,
      });
      throw error;
    }
  }
}
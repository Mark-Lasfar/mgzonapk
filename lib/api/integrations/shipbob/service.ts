import { logger } from '@/lib/api/services/logging';
import { ShipBobProduct, ShipBobOrder, ShipBobInventory } from './types';
import { Redis } from '@upstash/redis';

// Interfaces
interface ShipBobConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  channelId: string;
  apiUrl?: string;
}

interface ProductData {
  sku: string;
  name: string;
  quantity: number;
  location?: string;
  dimensions?: {
    length: number;
    width: number;
    height: number;
    weight: number;
  };
  bundle?: boolean;
  bundle_items?: Array<{ sku: string; quantity: number }>;
}

interface OrderData {
  orderId: string;
  items: Array<{
    sku: string;
    quantity: number;
    name: string;
    reference_id: string;
    isBundle?: boolean;
    components?: Array<{ sku: string; quantity: number; name?: string }>;
  }>;
  shippingAddress: {
    name: string;
    street: string;
    street2?: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    phone?: string;
    email?: string;
  };
  shippingMethod?: string;
  type?: string;
  tags?: Array<{ name: string; value: string }>;
  location_id?: number;
}

interface UpdateProductStatusData {
  id: string;
  status: 'enabled' | 'disabled';
}

interface ProductResponse {
  id: string;
  reference_id: string;
  name: string;
}

interface ShipmentResponse {
  id: string;
  status: string;
}

interface Warehouse {
  id: string;
  name: string;
  location: string;
  costPerUnit: number;
  supportedProducts: string[];
}

interface OAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

class ShipBobError extends Error {
  constructor(message: string, public status?: number, public retryAfter?: number) {
    super(message);
    this.name = 'ShipBobError';
  }
}

export class ShipBobService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly channelId: string;
  private readonly apiUrl: string;
  private readonly maxRetries: number = 3;
  private readonly baseRetryDelay: number = 1000;
  private accessToken?: string;
  private refreshToken?: string;
  private tokenExpiresAt?: number;
  private redis: Redis;

  constructor(config: ShipBobConfig) {
    if (!config.clientId || !config.clientSecret || !config.redirectUri || !config.channelId) {
      throw new Error('Invalid configuration: clientId, clientSecret, redirectUri, and channelId are required');
    }
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.redirectUri = config.redirectUri;
    this.channelId = config.channelId;
    this.apiUrl = config.apiUrl || 'https://api.shipbob.com';
    this.redis = new Redis({
      url: process.env.UPSTASH_REDIS_URL!,
      token: process.env.UPSTASH_REDIS_TOKEN!,
    });
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt - 60000) {
      return this.accessToken;
    }

    const cachedToken = await this.redis.get(`shipbob:token:${this.channelId}`);
    if (cachedToken) {
      const { accessToken, refreshToken, expiresAt } = JSON.parse(cachedToken as string);
      if (Date.now() < expiresAt - 60000) {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.tokenExpiresAt = expiresAt;
        return accessToken;
      }
    }

    if (this.refreshToken) {
      const tokenData = await this.refreshAccessToken(this.refreshToken);
      this.accessToken = tokenData.access_token;
      this.refreshToken = tokenData.refresh_token || this.refreshToken;
      this.tokenExpiresAt = Date.now() + tokenData.expires_in * 1000;
      await this.redis.set(
        `shipbob:token:${this.channelId}`,
        JSON.stringify({
          accessToken: this.accessToken,
          refreshToken: this.refreshToken,
          expiresAt: this.tokenExpiresAt,
        }),
        { ex: tokenData.expires_in }
      );
      return this.accessToken;
    }

    throw new ShipBobError('No valid access token or refresh token available');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}, retryCount = 0): Promise<{ data: T; nextPage?: string }> {
    try {
      const accessToken = await this.getAccessToken();
      const response = await fetch(`${this.apiUrl}${endpoint.startsWith('/') ? '' : '/1.0'}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'shipbob_channel_id': this.channelId,
          ...options.headers,
        },
      });

      const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
      if (rateLimitRemaining && parseInt(rateLimitRemaining, 10) < 10) {
        logger.warn('ShipBob API rate limit low', { endpoint, remaining: rateLimitRemaining });
      }

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '0', 10);
        if (retryCount >= this.maxRetries) {
          logger.error('Max retries reached for rate limit', { endpoint, retryAfter });
          throw new ShipBobError(`Rate limit exceeded after ${this.maxRetries} retries`, 429, retryAfter);
        }
        const delay = retryAfter * 1000 || this.baseRetryDelay * Math.pow(2, retryCount);
        logger.warn('Rate limit hit, retrying after delay', { endpoint, delay, retryCount: retryCount + 1 });
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.request<T>(endpoint, options, retryCount + 1);
      }

      if (response.status === 401) {
        logger.error('Unauthorized request, attempting token refresh', { endpoint });
        this.accessToken = undefined; // Force token refresh
        return this.request<T>(endpoint, options, retryCount);
      }

      if (response.status === 422) {
        let errorMessage = 'Unprocessable entity';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
          if (errorMessage.includes('reference_id')) {
            errorMessage = 'Duplicate reference_id detected';
          }
        } catch (parseError) {
          errorMessage = `Failed to parse 422 response: ${await response.text().slice(0, 100)}`;
          logger.error('Non-JSON response for 422 error', { endpoint, error: parseError });
        }
        logger.error('ShipBob API unprocessable entity', { endpoint, error: errorMessage });
        throw new ShipBobError(errorMessage, 422);
      }

      if (!response.ok) {
        let errorMessage = response.statusText;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch {
          errorMessage = `Non-JSON response: ${await response.text().slice(0, 100)}`;
        }
        logger.error('ShipBob API error', { endpoint, status: response.status, error: errorMessage });
        throw new ShipBobError(`ShipBob API error: ${errorMessage}`, response.status);
      }

      const data = await response.json();
      const nextPage = response.headers.get('next-page');
      logger.info('ShipBob API request successful', { endpoint, rateLimitRemaining });
      return { data, nextPage };
    } catch (error) {
      logger.error('ShipBob API request failed', { endpoint, error });
      throw error instanceof ShipBobError ? error : new ShipBobError(String(error));
    }
  }

  async exchangeAuthCode(code: string): Promise<OAuthTokenResponse> {
    try {
      const response = await fetch('https://auth.shipbob.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code,
          redirect_uri: this.redirectUri,
          grant_type: 'authorization_code',
        }).toString(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new ShipBobError(`OAuth token exchange failed: ${errorData.error_description || response.statusText}`, response.status);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.refreshToken = data.refresh_token;
      this.tokenExpiresAt = Date.now() + data.expires_in * 1000;
      await this.redis.set(
        `shipbob:token:${this.channelId}`,
        JSON.stringify({
          accessToken: this.accessToken,
          refreshToken: this.refreshToken,
          expiresAt: this.tokenExpiresAt,
        }),
        { ex: data.expires_in }
      );
      logger.info('ShipBob OAuth token exchanged successfully', { channelId: this.channelId });
      return data;
    } catch (error) {
      logger.error('ShipBob OAuth token exchange failed', { error });
      throw error instanceof ShipBobError ? error : new ShipBobError('OAuth token exchange failed');
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokenResponse> {
    try {
      const response = await fetch('https://auth.shipbob.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }).toString(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new ShipBobError(`Token refresh failed: ${errorData.error_description || response.statusText}`, response.status);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.refreshToken = data.refresh_token || refreshToken;
      this.tokenExpiresAt = Date.now() + data.expires_in * 1000;
      await this.redis.set(
        `shipbob:token:${this.channelId}`,
        JSON.stringify({
          accessToken: this.accessToken,
          refreshToken: this.refreshToken,
          expiresAt: this.tokenExpiresAt,
        }),
        { ex: data.expires_in }
      );
      logger.info('ShipBob access token refreshed successfully', { channelId: this.channelId });
      return data;
    } catch (error) {
      logger.error('ShipBob token refresh failed', { error });
      throw error instanceof ShipBobError ? error : new ShipBobError('Token refresh failed');
    }
  }

  private async ensureChannelProduct(sku: string, name: string): Promise<string> {
    try {
      const existingProduct = await this.getProductByReferenceId(sku);
      if (existingProduct) {
        logger.info('Channel product already exists', { sku, id: existingProduct.id });
        return existingProduct.id;
      }

      const response = await this.createProduct({ sku, name, quantity: 0 });
      return response.id;
    } catch (error) {
      if (error instanceof ShipBobError && error.status === 422) {
        logger.warn('Duplicate reference_id during product creation, fetching existing', { sku });
        const existingProduct = await this.getProductByReferenceId(sku);
        if (existingProduct) return existingProduct.id;
      }
      throw error;
    }
  }

  private async getProductByReferenceId(referenceId: string): Promise<ProductResponse | null> {
    try {
      const products = await this.getProducts();
      const product = products.find(p => p.reference_id === referenceId);
      return product ? { id: product.id, reference_id: product.reference_id, name: product.name } : null;
    } catch (error) {
      logger.error('Failed to fetch product by reference_id', { referenceId, error });
      throw error;
    }
  }

  async createProduct(data: ProductData): Promise<ProductResponse> {
    if (!data.sku || !data.name || data.quantity < 0) {
      throw new ShipBobError('Invalid product data: sku, name, and non-negative quantity are required');
    }

    if (data.dimensions && Object.values(data.dimensions).some(v => v <= 0)) {
      throw new ShipBobError('Invalid dimensions: length, width, height, and weight must be positive');
    }

    const payload: ShipBobProduct = {
      reference_id: data.sku,
      name: data.name,
      sku: data.sku,
      bundle: data.bundle || false,
      bundle_items: data.bundle_items?.map(item => ({
        reference_id: item.sku,
        quantity: item.quantity,
      })),
      dimensions: data.dimensions,
      inventory_settings: {
        reorder_point: 0,
        restock_level: data.quantity,
      },
    };

    const response = await this.request<ShipBobProduct>('/product', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    logger.info('Product created in ShipBob', { sku: data.sku, id: response.data.id });
    return {
      id: response.data.id,
      reference_id: response.data.reference_id,
      name: response.data.name,
    };
  }

  async createOrder(order: OrderData): Promise<ShipmentResponse> {
    if (!order.orderId || !order.items.length || !order.shippingAddress) {
      throw new ShipBobError('Invalid order data: orderId, items, and shippingAddress are required');
    }

    for (const item of order.items) {
      await this.ensureChannelProduct(item.sku, item.name);
      if (item.isBundle && item.components) {
        for (const component of item.components) {
          if (!component.name) component.name = `${item.name} - Component`;
          await this.ensureChannelProduct(component.sku, component.name);
        }
      }
    }

    for (const item of order.items) {
      const inventory = await this.getInventory([item.sku]);
      if (!inventory.length || inventory[0].available < item.quantity) {
        throw new ShipBobError(`Insufficient inventory for product ${item.sku}`);
      }
      if (item.isBundle && item.components) {
        for (const component of item.components) {
          const compInventory = await this.getInventory([component.sku]);
          if (!compInventory.length || compInventory[0].available < component.quantity * item.quantity) {
            throw new ShipBobError(`Insufficient inventory for bundle component ${component.sku}`);
          }
        }
      }
    }

    const [firstName, ...lastNameParts] = order.shippingAddress.name.split(' ');
    const lastName = lastNameParts.join(' ') || firstName;

    const payload: ShipBobOrder = {
      reference_id: order.orderId,
      shipping_method: order.shippingMethod || 'STANDARD',
      shipping_address: {
        first_name: firstName,
        last_name: lastName,
        address1: order.shippingAddress.street,
        address2: order.shippingAddress.street2 || '',
        city: order.shippingAddress.city,
        state: order.shippingAddress.state,
        country: order.shippingAddress.country,
        zip: order.shippingAddress.postalCode,
        phone: order.shippingAddress.phone || '',
        email: order.shippingAddress.email || '',
      },
      items: order.items.map(item => ({
        reference_id: item.sku,
        quantity: item.quantity,
      })),
      shipping_notes: order.tags?.map(t => `${t.name}: ${t.value}`).join(', '),
    };

    const response = await this.request<ShipmentResponse>('/order', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    logger.info('Order created in ShipBob', { orderId: order.orderId, trackingId: response.data.id });
    return response.data;
  }

  async getProducts(): Promise<ShipBobProduct[]> {
    const products: ShipBobProduct[] = [];
    let nextPage: string | undefined;

    do {
      const endpoint = nextPage ? `/product?${nextPage}` : '/product';
      const response = await this.request<ShipBobProduct[]>(endpoint);
      products.push(...response.data);
      nextPage = response.nextPage;
    } while (nextPage);

    return products;
  }

  async getInventory(skus?: string[]): Promise<ShipBobInventory[]> {
    const items: ShipBobInventory[] = [];
    let nextPage: string | undefined;
    const params = skus?.length ? `skus=${skus.join(',')}` : '';

    do {
      const endpoint = nextPage ? `/inventory?${nextPage}` : `/inventory${params ? `?${params}` : ''}`;
      const response = await this.request<ShipBobInventory[]>(endpoint);
      items.push(...response.data);
      nextPage = response.nextPage;
    } while (nextPage);

    return items;
  }

  async getProduct(productId: string): Promise<ShipBobProduct> {
    if (!productId) {
      throw new ShipBobError('Invalid productId: productId is required');
    }
    const response = await this.request<ShipBobProduct>(`/product/${productId}`);
    return response.data;
  }

  async updateProductStatus(data: UpdateProductStatusData): Promise<void> {
    if (!data.id || !['enabled', 'disabled'].includes(data.status)) {
      throw new ShipBobError('Invalid data: id and valid status (enabled/disabled) are required');
    }
    await this.request<void>(`/product/${data.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: data.status }),
    });
    logger.info('Product status updated in ShipBob', { id: data.id, status: data.status });
  }

  async getWarehouses(): Promise<Warehouse[]> {
    const response = await this.request<Warehouse[]>('/fulfillmentCenter');
    return response.data;
  }

  async checkConnection(): Promise<{ status: string; error?: string }> {
    try {
      await this.getAccessToken();
      await this.request<Warehouse[]>('/fulfillmentCenter');
      return { status: 'connected' };
    } catch (error) {
      return { status: 'disconnected', error: String(error) };
    }
  }
}
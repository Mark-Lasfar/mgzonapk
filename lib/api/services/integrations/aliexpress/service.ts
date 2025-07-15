import axios from 'axios';
import { customLogger } from '@/lib/api/services/logging';
import crypto from 'crypto';
import { z } from 'zod';

const aliExpressConfigSchema = z.object({
  apiKey: z.string().nonempty(),
  apiSecret: z.string().nonempty(),
  accessToken: z.string().nonempty(),
  refreshToken: z.string().nonempty(),
});

const aliExpressProductSchema = z.object({
  productId: z.string().nonempty(),
  title: z.string().min(3),
  description: z.string().optional(),
  price: z.number().positive(),
  imageUrl: z.string().url().optional(),
  currency: z.string().default('USD'),
  sku: z.string().optional(),
  brand: z.string().optional(),
  availability: z.enum(['in_stock', 'out_of_stock']).default('in_stock'),
});

interface AliExpressConfig {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  refreshToken: string;
}

export class AliExpressService {
  private config: z.infer<typeof aliExpressConfigSchema>;
  private apiUrl: string = process.env.ALIEXPRESS_API_URL || 'https://api.aliexpress.com';

  private readonly CURRENCY_BY_REGION = {
    us: 'USD',
    ca: 'CAD',
    uk: 'GBP',
    de: 'EUR',
    fr: 'EUR',
    ae: 'AED',
    sa: 'SAR',
  };

  constructor(config: AliExpressConfig) {
    this.config = aliExpressConfigSchema.parse(config);
  }

  private getAuthHeaders() {
    return {
      Authorization: `Bearer ${this.config.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  async refreshAccessToken() {
    const requestId = crypto.randomUUID();
    try {
      const response = await axios.post(`${this.apiUrl}/auth/refresh`, {
        refresh_token: this.config.refreshToken,
        api_key: this.config.apiKey,
        api_secret: this.config.apiSecret,
      });
      this.config.accessToken = response.data.access_token;
      await customLogger.info('AliExpress token refreshed', { requestId, service: 'aliexpress' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await customLogger.error('Failed to refresh AliExpress token', { requestId, error: errorMessage, service: 'aliexpress' });
      throw error;
    }
  }

  async getProductById(productId: string, region: string = 'us') {
    const requestId = crypto.randomUUID();
    try {
      const response = await axios.get(`${this.apiUrl}/product/${productId}`, {
        headers: this.getAuthHeaders(),
        params: { region },
      });

      const product = {
        productId: response.data.product_id,
        title: response.data.subject,
        description: response.data.description || '',
        price: Number(response.data.price),
        imageUrl: response.data.image_urls?.[0],
        currency: this.CURRENCY_BY_REGION[region.toLowerCase()] || 'USD',
        sku: response.data.sku_code,
        brand: response.data.brand,
        availability: response.data.stock > 0 ? 'in_stock' : 'out_of_stock',
      };

      const validatedProduct = aliExpressProductSchema.parse(product);
      await customLogger.info('Fetched AliExpress product', { requestId, productId, service: 'aliexpress' });
      return validatedProduct;
    } catch (error) {
      if (error.response?.status === 401) {
        await this.refreshAccessToken();
        return this.getProductById(productId, region);
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      await customLogger.error('Failed to fetch AliExpress product', { requestId, error: errorMessage, productId, service: 'aliexpress' });
      throw error;
    }
  }
}
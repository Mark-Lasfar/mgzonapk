import axios from 'axios';
import { customLogger } from '@/lib/api/services/logging';
import crypto from 'crypto';
import { z } from 'zod';
import { MarketplaceProduct } from '@/lib/types/marketplace';

const shopifyConfigSchema = z.object({
  shopDomain: z.string().nonempty(),
  accessToken: z.string().nonempty(),
});

const shopifyProductSchema = z.object({
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

interface ShopifyConfig {
  shopDomain: string;
  accessToken: string;
}

export class ShopifyService {
  private config: z.infer<typeof shopifyConfigSchema>;
  private http: any;

  private readonly CURRENCY_BY_REGION: Record<string, string> = {
    us: 'USD',
    ca: 'CAD',
    uk: 'GBP',
    au: 'AUD',
    de: 'EUR',
    fr: 'EUR',
    it: 'EUR',
    es: 'EUR',
    sa: 'SAR',
    ae: 'AED',
    eg: 'EGP',
    jp: 'JPY',
  };

  constructor(config: ShopifyConfig) {
    this.config = shopifyConfigSchema.parse(config);
    this.http = axios.create({
      baseURL: `https://${this.config.shopDomain}/admin/api/2023-10`,
      headers: {
        'X-Shopify-Access-Token': this.config.accessToken,
        'Content-Type': 'application/json',
      },
    });
  }

  async getProductById(productId: string, region: string = 'us'): Promise<MarketplaceProduct | null> {
    const requestId = crypto.randomUUID();
    try {
      const response = await this.http.get(`/products/${productId}.json`);
      const product = response.data.product;

      const shopifyProduct = {
        productId: product.id.toString(),
        title: product.title,
        description: product.body_html || '',
        price: parseFloat(product.variants[0]?.price || '0'),
        imageUrl: product.images[0]?.src,
        currency: this.CURRENCY_BY_REGION[region.toLowerCase()] || 'USD',
        sku: product.variants[0]?.sku,
        brand: product.vendor,
        availability: product.variants[0]?.inventory_quantity > 0 ? 'in_stock' : 'out_of_stock',
      };

      const validatedProduct = shopifyProductSchema.parse(shopifyProduct);
      await customLogger.info('Fetched Shopify product', { requestId, productId, region, service: 'shopify' });
      return {
        id: crypto.randomUUID(),
        title: validatedProduct.title,
        description: validatedProduct.description,
        price: validatedProduct.price,
        images: validatedProduct.imageUrl ? [{ url: validatedProduct.imageUrl }] : [],
        sku: validatedProduct.sku || validatedProduct.productId,
        quantity: validatedProduct.availability === 'in_stock' ? 1 : 0,
        vendor: validatedProduct.brand,
        variants: [],
        options: [],
        categories: [],
        tags: [],
        attributes: {},
        status: 'pending',
        source: 'shopify',
        sourceId: validatedProduct.productId,
        currency: validatedProduct.currency,
        region,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await customLogger.error('Failed to fetch Shopify product', { requestId, productId, region, error: errorMessage, service: 'shopify' });
      return null;
    }
  }

  async searchProducts(query: string, region: string = 'us', limit: number = 10): Promise<MarketplaceProduct[]> {
    const requestId = crypto.randomUUID();
    try {
      const response = await this.http.get('/products.json', {
        params: { title: query, limit },
      });

      const products = response.data.products?.map((item: any) => {
        const product = shopifyProductSchema.parse({
          productId: item.id.toString(),
          title: item.title,
          description: item.body_html || '',
          price: parseFloat(item.variants[0]?.price || '0'),
          imageUrl: item.images[0]?.src,
          currency: this.CURRENCY_BY_REGION[region.toLowerCase()] || 'USD',
          sku: item.variants[0]?.sku,
          brand: item.vendor,
          availability: item.variants[0]?.inventory_quantity > 0 ? 'in_stock' : 'out_of_stock',
        });

        return {
          id: crypto.randomUUID(),
          title: product.title,
          description: product.description,
          price: product.price,
          images: product.imageUrl ? [{ url: product.imageUrl }] : [],
          sku: product.sku || product.productId,
          quantity: product.availability === 'in_stock' ? 1 : 0,
          vendor: product.brand,
          variants: [],
          options: [],
          categories: [],
          tags: [],
          attributes: {},
          status: 'pending',
          source: 'shopify',
          sourceId: product.productId,
          currency: product.currency,
          region,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }) || [];

      await customLogger.info('Shopify products searched successfully', { requestId, query, count: products.length, region, service: 'shopify' });
      return products;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await customLogger.error('Failed to search Shopify products', { requestId, query, region, error: errorMessage, service: 'shopify' });
      return [];
    }
  }
}
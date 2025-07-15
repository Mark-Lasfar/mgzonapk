// lib/api/integrations/marketplaces/unified-service.ts
import { customLogger } from '@/lib/api/services/logging';
import { MarketplaceProduct } from '@/lib/types/marketplace';
import { GenericIntegrationService } from '@/lib/api/services/generic-integration';
import Integration from '@/lib/db/models/integration.model';
import SellerIntegration from '@/lib/db/models/seller-integration.model';
import crypto from 'crypto';
import { z } from 'zod';

const platformConfigSchema = z.object({
  providerId: z.string().nonempty('Provider ID is required'),
  settings: z.object({
    apiUrl: z.string().url('Invalid API URL').optional(),
    endpoints: z.record(z.string().url('Invalid endpoint URL')).optional(),
    supportedCurrencies: z.record(z.array(z.string())).optional(),
    supportedRegions: z.array(z.string()).optional(),
  }).optional(),
  credentials: z.object({
    apiKey: z.string().optional(),
    apiSecret: z.string().optional(),
    accessToken: z.string().optional(),
    refreshToken: z.string().optional(),
    clientId: z.string().optional(),
    clientSecret: z.string().optional(),
  }).optional(),
});

interface PlatformConfig {
  providerId: string;
  settings?: {
    apiUrl?: string;
    endpoints?: Record<string, string>;
    supportedCurrencies?: Record<string, string[]>;
    supportedRegions?: string[];
  };
  credentials?: {
    apiKey?: string;
    apiSecret?: string;
    accessToken?: string;
    refreshToken?: string;
    clientId?: string;
    clientSecret?: string;
  };
}

export class UnifiedMarketplaceService {
  private services: Map<string, GenericIntegrationService> = new Map();

  constructor(configs: PlatformConfig[]) {
    for (const config of configs) {
      const validatedConfig = platformConfigSchema.parse(config);
      this.initializeService(validatedConfig);
    }
  }

  private async initializeService(config: PlatformConfig) {
    try {
      const integration = await Integration.findOne({ _id: config.providerId, type: 'dropshipping', isActive: true });
      if (!integration) {
        throw new Error(`Integration not found: ${config.providerId}`);
      }

      const sellerIntegration = await SellerIntegration.findOne({
        integrationId: integration._id,
        isActive: true,
      });
      if (!sellerIntegration) {
        throw new Error(`Seller integration not connected for ${integration.providerName}`);
      }

      const service = new GenericIntegrationService(integration, sellerIntegration);
      this.services.set(integration.providerName, service);
    } catch (error) {
      await customLogger.error('Failed to initialize service', {
        providerId: config.providerId,
        error: error instanceof Error ? error.message : String(error),
        service: 'unified-marketplace',
      });
    }
  }

  async getProductById(
    providerName: string,
    id: string,
    region: string = 'global'
  ): Promise<MarketplaceProduct | null> {
    const requestId = crypto.randomUUID();
    try {
      const service = this.services.get(providerName);
      if (!service) {
        throw new Error(`${providerName} service not initialized`);
      }

      const integration = await Integration.findOne({ providerName, type: 'dropshipping', isActive: true });
      if (!integration) {
        throw new Error(`Integration not found: ${providerName}`);
      }

      const response = await service.callApi({
        endpoint: integration.settings.endpoints?.getProduct || `/products/${id}`,
        method: 'GET',
        params: { id, region },
      });

      if (!response) {
        await customLogger.warn(`Product not found on ${providerName}`, {
          requestId,
          id,
          region,
          service: 'unified-marketplace',
        });
        return null;
      }

      const product: MarketplaceProduct = {
        id: response.productId,
        title: response.title,
        description: response.description,
        price: response.price,
        images: response.images?.map((url: string) => ({ url })) || [response.imageUrl].filter(Boolean).map((url: string) => ({ url })),
        sku: response.sku || `SKU-${response.productId}`,
        quantity: response.quantity || 10,
        source: providerName.toLowerCase(),
        sourceId: response.productId,
        sourceStoreId: response.storeId,
        currency: response.currency || 'USD',
        status: 'pending',
        categories: response.categories || [],
        region: region,
        createdAt: new Date(),
      };

      await customLogger.info(`Product fetched from ${providerName}`, {
        requestId,
        id,
        region,
        service: 'unified-marketplace',
      });
      return product;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await customLogger.error(`Failed to fetch product from ${providerName}`, {
        requestId,
        id,
        error: errorMessage,
        region,
        service: 'unified-marketplace',
      });
      return null;
    }
  }

  async searchProducts(
    providerName: string,
    query: string,
    region: string = 'global',
    limit: number = 10
  ): Promise<MarketplaceProduct[]> {
    const requestId = crypto.randomUUID();
    try {
      const service = this.services.get(providerName);
      if (!service) {
        throw new Error(`${providerName} service not initialized`);
      }

      const integration = await Integration.findOne({ providerName, type: 'dropshipping', isActive: true });
      if (!integration) {
        throw new Error(`Integration not found: ${providerName}`);
      }

      const response = await service.callApi({
        endpoint: integration.settings.endpoints?.searchProducts || '/products/search',
        method: 'GET',
        params: { query, region, limit },
      });

      if (!response || !Array.isArray(response.products)) {
        await customLogger.warn(`No products found on ${providerName}`, {
          requestId,
          query,
          region,
          service: 'unified-marketplace',
        });
        return [];
      }

      const products: MarketplaceProduct[] = response.products.map((item: any) => ({
        id: item.productId,
        title: item.title,
        description: item.description,
        price: item.price,
        images: item.images?.map((url: string) => ({ url })) || [item.imageUrl].filter(Boolean).map((url: string) => ({ url })),
        sku: item.sku || `SKU-${item.productId}`,
        quantity: item.quantity || 10,
        source: providerName.toLowerCase(),
        sourceId: item.productId,
        sourceStoreId: item.storeId,
        currency: item.currency || 'USD',
        status: 'pending',
        categories: item.categories || [],
        region: region,
        createdAt: new Date(),
      }));

      await customLogger.info(`Products searched from ${providerName}`, {
        requestId,
        query,
        count: products.length,
        region,
        service: 'unified-marketplace',
      });
      return products;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await customLogger.error(`Failed to search products from ${providerName}`, {
        requestId,
        query,
        error: errorMessage,
        region,
        service: 'unified-marketplace',
      });
      return [];
    }
  }
}
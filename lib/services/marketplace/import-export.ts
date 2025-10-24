import { MarketplaceProduct, ImportOptions, ExportResult, ImportResult } from '@/lib/types/marketplace';
import Product from '@/lib/db/models/product.model';
import Integration from '@/lib/db/models/integration.model';
import SellerIntegration from '@/lib/db/models/seller-integration.model';
import { decrypt } from '@/lib/utils/encryption';
import fetch from 'node-fetch';
import crypto from 'crypto';

// دالة مساعدة لتسجيل الـ logs عبر API
async function logToApi(type: 'info' | 'error', message: string, meta: any, error?: string) {
  try {
    await fetch('/api/log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type,
        message,
        error,
        meta,
      }),
    });
  } catch (err) {
    console.error('Failed to send log to /api/log:', err);
  }
}

// Interface for API response data to type `data` in getProduct and getInventory
interface ApiProductResponse {
  [key: string]: any; // Flexible to handle dynamic keys
  title?: string;
  description?: string;
  price?: string | number;
  sku?: string;
  quantity?: string | number;
  images?: string[];
  categories?: string[];
  currency?: string;
  region?: string;
  id?: string;
  availability?: string; // Added to handle availability
}

export class ImportExportService {
  private async getIntegrationService(integration: any, sellerIntegration: any) {
    const settings = integration.settings || {};
    const credentials = sellerIntegration.credentials || new Map();

    const config: any = {
      apiUrl: settings.apiUrl || settings.baseUrl,
      authType: settings.authType || 'Bearer',
    };

    // Handle different authentication types
    if (settings.authType === 'Bearer') {
      config.accessToken = decrypt(credentials.get('accessToken') || '');
    } else if (settings.authType === 'Basic') {
      const username = decrypt(credentials.get('username') || '');
      const password = decrypt(credentials.get('password') || '');
      config.authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
    } else if (settings.authType === 'APIKey') {
      config.apiKey = decrypt(credentials.get('apiKey') || '');
    } else if (settings.authType === 'OAuth') {
      config.accessToken = decrypt(credentials.get('accessToken') || '');
      config.clientId = decrypt(settings.clientId || '');
      config.clientSecret = decrypt(settings.clientSecret || '');
      config.refreshTokenUrl = settings.refreshTokenUrl;
    }

    return {
      async getProduct(productId: string): Promise<MarketplaceProduct> {
        const endpoint = settings.endpoints?.get('get')?.replace(':id', productId) || `/products/${productId}`;
        const response = await fetch(`${config.apiUrl}${endpoint}`, {
          headers: {
            ...(config.authType === 'Bearer' && { Authorization: `Bearer ${config.accessToken}` }),
            ...(config.authType === 'Basic' && { Authorization: config.authHeader }),
            ...(config.authType === 'APIKey' && { 'X-API-Key': config.apiKey }),
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch product ${productId}: ${response.statusText}`);
        }

        const rawData = await response.json();
        const data = rawData as ApiProductResponse;
        const responseMapping = settings.responseMapping || new Map();

        const quantity = parseInt(String(data[responseMapping.get('quantity') || 'quantity'] || '0'), 10);
        return {
          title: data[responseMapping.get('title') || 'title'] || 'Untitled',
          description: data[responseMapping.get('description') || 'description'] || '',
          price: parseFloat(String(data[responseMapping.get('price') || 'price'] || '0')),
          sku: data[responseMapping.get('sku') || 'sku'] || `SKU-${crypto.randomUUID()}`,
          quantity,
          images: (data[responseMapping.get('images') || 'images'] || []).map((url: string) => ({ url })),
          categories: data[responseMapping.get('categories') || 'categories'] || [],
          currency: data[responseMapping.get('currency') || 'currency'] || 'USD',
          region: data[responseMapping.get('region') || 'region'] || 'global',
          sourcePlatform: integration.providerName,
          sourceId: data[responseMapping.get('id') || 'id'] || productId,
          status: 'imported',
          availability: data[responseMapping.get('availability') || 'availability'] || (quantity > 0 ? 'in_stock' : 'out_of_stock'), // Add availability
          variants: [],
          options: [],
          tags: [],
          attributes: {},
        };
      },

      async createProduct(product: Partial<MarketplaceProduct>): Promise<{ id: string }> {
        const endpoint = settings.endpoints?.get('create') || '/products';
        const response = await fetch(`${config.apiUrl}${endpoint}`, {
          method: 'POST',
          headers: {
            ...(config.authType === 'Bearer' && { Authorization: `Bearer ${config.accessToken}` }),
            ...(config.authType === 'Basic' && { Authorization: config.authHeader }),
            ...(config.authType === 'APIKey' && { 'X-API-Key': config.apiKey }),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            [settings.responseMapping?.get('title') || 'title']: product.title,
            [settings.responseMapping?.get('description') || 'description']: product.description,
            [settings.responseMapping?.get('price') || 'price']: product.price,
            [settings.responseMapping?.get('sku') || 'sku']: product.sku,
            [settings.responseMapping?.get('quantity') || 'quantity']: product.quantity,
            [settings.responseMapping?.get('images') || 'images']: product.images?.map(img => img.url) || [],
            [settings.responseMapping?.get('categories') || 'categories']: product.categories || [],
            [settings.responseMapping?.get('currency') || 'currency']: product.currency || 'USD',
            [settings.responseMapping?.get('region') || 'region']: product.region || 'global',
            [settings.responseMapping?.get('availability') || 'availability']: product.availability || (product.quantity && product.quantity > 0 ? 'in_stock' : 'out_of_stock'), // Add availability
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to create product: ${response.statusText}`);
        }

        const rawData = await response.json();
        const data = rawData as ApiProductResponse;
        return { id: String(data[settings.responseMapping?.get('id') || 'id'] || crypto.randomUUID()) };
      },

      async getInventory(productId: string): Promise<{ quantity: number; availability: string }> { // Updated return type
        const endpoint = settings.endpoints?.get('sync')?.replace(':id', productId) || `/products/${productId}/inventory`;
        const response = await fetch(`${config.apiUrl}${endpoint}`, {
          headers: {
            ...(config.authType === 'Bearer' && { Authorization: `Bearer ${config.accessToken}` }),
            ...(config.authType === 'Basic' && { Authorization: config.authHeader }),
            ...(config.authType === 'APIKey' && { 'X-API-Key': config.apiKey }),
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch inventory for product ${productId}: ${response.statusText}`);
        }

        const rawData = await response.json();
        const data = rawData as ApiProductResponse;
        const quantity = parseInt(String(data[settings.responseMapping?.get('quantity') || 'quantity'] || '0'), 10);
        return { 
          quantity,
          availability: data[settings.responseMapping?.get('availability') || 'availability'] || (quantity > 0 ? 'in_stock' : 'out_of_stock'), // Add availability
        };
      },
    };
  }

  async importProducts(
    provider: string,
    sellerId: string,
    options: ImportOptions
  ): Promise<ImportResult> {
    const requestId = crypto.randomUUID();
    const startTime = Date.now();
    try {
      const integration = await Integration.findOne({ providerName: provider, type: 'marketplace', isActive: true });
      if (!integration) {
        throw new Error('Integration not found');
      }

      const sellerIntegration = await SellerIntegration.findOne({
        sellerId,
        integrationId: integration._id,
        isActive: true,
        status: 'connected',
      });
      if (!sellerIntegration) {
        throw new Error('Integration not connected');
      }

      const service = await this.getIntegrationService(integration, sellerIntegration);
      let products: MarketplaceProduct[] = [];

      if (options.source === 'file' && options.products) {
        products = options.products.map((item) => ({
          title: item.title,
          description: item.description || 'No description provided',
          price: item.price,
          sku: item.sku || `SKU-${crypto.randomUUID()}`,
          quantity: item.quantity || 0,
          images: (item.images || []).map((url: string) => ({ url })),
          categories: item.categories || [],
          currency: item.currency || 'USD',
          region: options.region || 'global',
          sourcePlatform: provider,
          sourceId: item.sourceId || `file-${crypto.randomUUID()}`,
          sourceStoreId: sellerId,
          status: 'imported',
          availability: item.quantity && item.quantity > 0 ? 'in_stock' : 'out_of_stock', // Add availability
          createdAt: new Date(),
          createdBy: sellerId,
          variants: [],
          options: [],
          tags: [],
          attributes: {},
        }));
      } else if (options.source === 'api' && options.productId) {
        const productData = await service.getProduct(options.productId);
        products = [{
          ...productData,
          sourceStoreId: sellerId,
          createdAt: new Date(),
          createdBy: sellerId,
        }];
      } else {
        throw new Error('Invalid import options');
      }

      const importedProducts: MarketplaceProduct[] = [];
      for (const product of products) {
        const savedProduct = await Product.create(product);
        importedProducts.push(savedProduct);
      }

      await logToApi('info', 'Products imported successfully', {
        requestId,
        provider,
        sellerId,
        count: importedProducts.length,
        service: 'marketplace',
      });

      return {
        success: true,
        products: importedProducts,
        stats: {
          total: products.length,
          imported: importedProducts.length,
          failed: 0,
          updated: 0,
          skipped: 0,
          timeElapsed: Date.now() - startTime,
        },
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await logToApi('error', 'Failed to import products', {
        requestId,
        error: errorMessage,
        code: error instanceof Error ? 'IMPORT_FAILED' : 'UNKNOWN_ERROR',
        service: 'marketplace',
      }, errorMessage);
      throw new Error(errorMessage);
    }
  }

  async exportProduct(
    provider: string,
    sellerId: string,
    options: { productId: string; region?: string }
  ): Promise<ExportResult> {
    const requestId = crypto.randomUUID();
    const startTime = Date.now();
    try {
      const integration = await Integration.findOne({ providerName: provider, type: 'marketplace', isActive: true });
      if (!integration) {
        throw new Error('Integration not found');
      }

      const sellerIntegration = await SellerIntegration.findOne({
        sellerId,
        integrationId: integration._id,
        isActive: true,
        status: 'connected',
      });
      if (!sellerIntegration) {
        throw new Error('Integration not connected');
      }

      const product = await Product.findById(options.productId);
      if (!product) {
        throw new Error('Product not found');
      }

      const service = await this.getIntegrationService(integration, sellerIntegration);
      const exportData = {
        title: product.title,
        description: product.description,
        price: product.price,
        sku: product.sku,
        quantity: product.quantity,
        images: product.images,
        categories: product.categories,
        currency: product.currency,
        region: options.region || product.region,
        availability: product.availability || (product.quantity > 0 ? 'in_stock' : 'out_of_stock'), // Add availability
      };

      const result = await service.createProduct(exportData);
      await logToApi('info', 'Product exported successfully', {
        requestId,
        provider,
        sellerId,
        productId: options.productId,
        exportedId: result.id,
        service: 'marketplace',
      });

      return {
        success: true,
        data: exportData,
        exportedId: result.id,
        stats: {
          total: 1,
          exported: 1,
          failed: 0,
          timeElapsed: Date.now() - startTime,
        },
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await logToApi('error', 'Failed to export product', {
        requestId,
        error: errorMessage,
        code: error instanceof Error ? 'EXPORT_FAILED' : 'UNKNOWN_ERROR',
        service: 'marketplace',
      }, errorMessage);
      throw new Error(errorMessage);
    }
  }

  async syncInventory(
    productId: string,
    sellerId: string,
    provider: string,
    region: string
  ): Promise<{ quantity: number; availability: string }> { // Updated return type
    const requestId = crypto.randomUUID();
    const startTime = Date.now();
    try {
      const integration = await Integration.findOne({ providerName: provider, type: 'marketplace', isActive: true });
      if (!integration) {
        throw new Error('Integration not found');
      }

      const sellerIntegration = await SellerIntegration.findOne({
        sellerId,
        integrationId: integration._id,
        isActive: true,
        status: 'connected',
      });
      if (!sellerIntegration) {
        throw new Error('Integration not connected');
      }

      const product = await Product.findById(productId);
      if (!product) {
        throw new Error('Product not found');
      }

      const service = await this.getIntegrationService(integration, sellerIntegration);
      const remoteInventory = await service.getInventory(product.sourceId || product._id.toString());

      await Product.updateOne(
        { _id: productId },
        { 
          quantity: remoteInventory.quantity, 
          availability: remoteInventory.availability, // Add availability
          lastSyncedAt: new Date() 
        }
      );

      await logToApi('info', 'Inventory synced successfully', {
        requestId,
        provider,
        sellerId,
        productId,
        quantity: remoteInventory.quantity,
        availability: remoteInventory.availability, // Add availability
        service: 'marketplace',
      });

      return { 
        quantity: remoteInventory.quantity,
        availability: remoteInventory.availability // Add availability
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await logToApi('error', 'Failed to sync inventory', {
        requestId,
        error: errorMessage,
        code: error instanceof Error ? 'SYNC_FAILED' : 'UNKNOWN_ERROR',
        service: 'marketplace',
      }, errorMessage);
      throw new Error(errorMessage);
    }
  }
}
import SellerIntegration, { ISellerIntegration } from '@/lib/db/models/seller-integration.model';
import axios from 'axios';
import { ProductImportService } from '@/lib/api/services/product-import';
import { SellerError } from '@/lib/errors/seller-error';
import { z } from 'zod';

// دالة مساعدة لتسجيل الـ logs عبر API
async function logToApi(type: 'info' | 'error', message: string, meta: any, error?: any) {
  try {
    await fetch('/api/log', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type,
        message,
        error: error ? String(error) : undefined,
        meta,
      }),
    });
  } catch (err) {
    console.error('Failed to send log to /api/log:', err);
  }
}

// تعريف أنواع البيانات
interface IntegrationData {
  _id: string;
  type: 'payment' | 'warehouse' | 'dropshipping' | 'marketplace' | 'shipping' | 'marketing' | 'accounting' | 'crm' | 'analytics' | 'automation' | 'communication' | 'education' | 'security' | 'advertising' | 'tax' | 'other';
  status: 'connected' | 'disconnected' | 'expired' | 'needs_reauth';
  providerName: string;
  settings: { [key: string]: any };
  logoUrl?: string;
  webhook?: ISellerIntegration['webhook'];
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// Schema للتحقق من بيانات المنتج
const ProductResponseSchema = z.object({
  sourceId: z.string(),
  title: z.string(),
  description: z.string().optional(),
  price: z.number(),
  quantity: z.number(),
  images: z.array(z.object({ url: z.string() })).optional(),
  category: z.string().optional(),
  sku: z.string().optional(),
  currency: z.string(),
  region: z.string().optional(),
  availability: z.enum(['in_stock', 'out_of_stock']),
});

// دالة لجلب التكاملات الديناميكية
export async function getDynamicIntegrations(sellerId: string, sandbox: boolean): Promise<ApiResponse<IntegrationData[]>> {
  try {
    const sellerIntegrations = await SellerIntegration.find({
      sellerId,
      isActive: true,
      sandboxMode: sandbox,
    })
      .populate('integrationId')
      .lean();

    const result = sellerIntegrations.map((si: any) => {
      const integration = si.integrationId;
      return {
        _id: integration._id.toString(),
        type: integration.type,
        status: si.status ?? 'connected', // Default to 'connected' if undefined
        providerName: integration.providerName,
        settings: integration.settings,
        logoUrl: integration.logoUrl,
        webhook: si.webhook,
      };
    });

    await logToApi('info', `Fetched ${result.length} integrations for seller ${sellerId} (sandbox: ${sandbox})`, {
      sellerId,
      sandbox,
    });

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    await logToApi('error', 'Error fetching integrations', { sellerId, sandbox }, error);
    return {
      success: false,
      data: [],
      message: error instanceof Error ? error.message : 'Failed to fetch integrations',
    };
  }
}

// كلاس لإدارة التكاملات الديناميكية
export class DynamicIntegrationService {
  private integration: IntegrationData;
  private sellerIntegration: ISellerIntegration;
  private productImportService: ProductImportService;

  constructor(integration: IntegrationData, sellerIntegration: ISellerIntegration) {
    this.integration = integration;
    this.sellerIntegration = sellerIntegration;
    this.productImportService = new ProductImportService();
  }

  async callApi<T>(config: { endpoint: string; method: string; body?: any; headers?: Record<string, string> }): Promise<T> {
    const { endpoint, method, body, headers } = config;
    try {
      const response = await axios({
        url: endpoint,
        method,
        data: body,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      });
      return response.data;
    } catch (error) {
      throw new SellerError('API_CALL_FAILED', error instanceof Error ? error.message : 'Failed to call API');
    }
  }

  private async sendWebhook(event: string, payload: any) {
    const webhook = this.sellerIntegration.webhook;
    if (webhook?.enabled && webhook.url) {
      try {
        await this.callApi({
          endpoint: webhook.url,
          method: 'POST',
          body: {
            event,
            data: payload,
            timestamp: new Date().toISOString(),
          },
          headers: webhook.secret ? { 'X-Webhook-Secret': webhook.secret } : {},
        });
        await logToApi('info', `Webhook sent for ${event}`, { url: webhook.url });
      } catch (error) {
        await logToApi('error', `Failed to send webhook for ${event}`, { url: webhook.url }, error);
      }
    }
  }

  // استيراد منتج من مزود دروبشيبينغ
  async importProduct(productId: string, sellerId: string, region: string = 'global'): Promise<{
    sourceId: string;
    name: string;
    description: string;
    price: number;
    countInStock: number;
    category: string;
    images: string[];
    sku?: string;
    currency: string;
    availability: 'in_stock' | 'out_of_stock';
    region?: string;
  }> {
    try {
      if (this.integration.type !== 'dropshipping') {
        throw new SellerError('INVALID_INTEGRATION_TYPE', 'Integration type is not dropshipping');
      }

      const product = await this.productImportService.importProduct(
        this.integration._id,
        productId,
        sellerId,
        region
      );

      // التحقق من بيانات المنتج باستخدام zod
      const validatedProduct = ProductResponseSchema.parse({
        sourceId: product.sourceId,
        title: product.title,
        description: product.description || '',
        price: product.price,
        quantity: product.quantity,
        images: product.images || [],
        category: product.categories?.[0] || 'Uncategorized',
        sku: product.sku,
        currency: product.currency,
        region: product.region,
        availability: product.availability,
      });

      const productData = {
        sourceId: validatedProduct.sourceId,
        name: validatedProduct.title,
        description: validatedProduct.description || '',
        price: validatedProduct.price,
        countInStock: validatedProduct.quantity,
        category: validatedProduct.category || 'Uncategorized',
        images: validatedProduct.images?.map((img) => img.url) || [], // Handle undefined images
        sku: validatedProduct.sku,
        currency: validatedProduct.currency,
        availability: validatedProduct.availability,
        region: validatedProduct.region,
      };

      await this.sendWebhook('product.imported', productData);

      await logToApi('info', `Product imported from ${this.integration.providerName}`, {
        productId,
        sellerId,
        region,
      });

      return productData;
    } catch (error) {
      await logToApi('error', 'Error importing product', {
        productId,
        sellerId,
        provider: this.integration.providerName,
      }, error);
      throw error instanceof SellerError ? error : new SellerError('IMPORT_FAILED', error instanceof Error ? error.message : 'Failed to import product');
    }
  }

  // إنشاء منتج في المستودع
  async createProduct(product: {
    externalId: string;
    name: string;
    sku: string;
    quantity: number;
    price: number;
  }): Promise<void> {
    try {
      if (this.integration.type !== 'warehouse') {
        throw new SellerError('INVALID_INTEGRATION_TYPE', 'Integration type is not warehouse');
      }

      const { providerName, settings } = this.integration;
      const { credentials, apiEndpoints } = this.sellerIntegration;
      const apiKey = credentials?.get('apiKey');
      const baseUrl = apiEndpoints?.get('baseUrl') || settings.apiUrl;
      const productEndpoint = settings.apiEndpoints?.createProduct || '/products';

      if (!apiKey || !baseUrl) {
        throw new SellerError('MISSING_CREDENTIALS', 'Missing API credentials or base URL');
      }

      await axios.post(
        `${baseUrl}${productEndpoint}`,
        {
          externalId: product.externalId,
          name: product.name,
          sku: product.sku,
          quantity: product.quantity,
          price: product.price,
        },
        {
          headers: { Authorization: `Bearer ${apiKey}` },
        }
      );

      await this.sendWebhook('product.created', product);

      await logToApi('info', `Product created in warehouse ${providerName}`, { externalId: product.externalId });
    } catch (error) {
      await logToApi('error', 'Error creating product in warehouse', { provider: this.integration.providerName }, error);
      throw error instanceof SellerError ? error : new SellerError('CREATE_FAILED', error instanceof Error ? error.message : 'Failed to create product');
    }
  }

  // مزامنة المخزون من مزود دروبشيبينغ أو مستودع
  async syncInventory(productId: string, sellerId: string): Promise<{ quantity: number; availability: string }> {
    try {
      if (!['dropshipping', 'warehouse'].includes(this.integration.type)) {
        throw new SellerError('INVALID_INTEGRATION_TYPE', `Integration type ${this.integration.type} does not support inventory sync`);
      }

      const inventoryData = await this.productImportService.syncInventory(
        productId,
        sellerId,
        this.integration._id,
        'global'
      );

      await this.sendWebhook('product.synced', inventoryData);

      await logToApi('info', `Inventory synced from ${this.integration.providerName}`, {
        productId,
        sellerId,
        quantity: inventoryData.quantity,
        availability: inventoryData.availability,
      });

      return inventoryData;
    } catch (error) {
      await logToApi('error', 'Error syncing inventory', {
        productId,
        sellerId,
        provider: this.integration.providerName,
      }, error);
      throw error instanceof SellerError ? error : new SellerError('SYNC_FAILED', error instanceof Error ? error.message : 'Failed to sync inventory');
    }
  }

  // تحديث منتج في مزود دروبشيبينغ أو مستودع
  async updateProduct(
    productId: string,
    updates: {
      name?: string;
      price?: number;
      quantity?: number;
      sku?: string;
      description?: string;
    }
  ): Promise<void> {
    try {
      if (!['dropshipping', 'warehouse'].includes(this.integration.type)) {
        throw new SellerError('INVALID_INTEGRATION_TYPE', `Integration type ${this.integration.type} does not support product updates`);
      }

      const { providerName, settings } = this.integration;
      const { credentials, apiEndpoints } = this.sellerIntegration;
      const apiKey = credentials?.get('apiKey');
      const baseUrl = apiEndpoints?.get('baseUrl') || settings.apiUrl;

      if (!apiKey || !baseUrl) {
        throw new SellerError('MISSING_CREDENTIALS', 'Missing API credentials or base URL');
      }

      await axios.patch(
        `${baseUrl}/products/${productId}`,
        updates,
        {
          headers: { Authorization: `Bearer ${apiKey}` },
        }
      );

      await this.sendWebhook('product.updated', { productId, ...updates });

      await logToApi('info', `Product updated in ${providerName}`, { productId, updates });
    } catch (error) {
      await logToApi('error', 'Error updating product', { productId, provider: this.integration.providerName }, error);
      throw error instanceof SellerError ? error : new SellerError('UPDATE_FAILED', error instanceof Error ? error.message : 'Failed to update product');
    }
  }

  // حذف منتج من مزود دروبشيبينغ أو مستودع
  async deleteProduct(productId: string): Promise<void> {
    try {
      if (!['dropshipping', 'warehouse'].includes(this.integration.type)) {
        throw new SellerError('INVALID_INTEGRATION_TYPE', `Integration type ${this.integration.type} does not support product deletion`);
      }

      const { providerName, settings } = this.integration;
      const { credentials, apiEndpoints } = this.sellerIntegration;
      const apiKey = credentials?.get('apiKey');
      const baseUrl = apiEndpoints?.get('baseUrl') || settings.apiUrl;

      if (!apiKey || !baseUrl) {
        throw new SellerError('MISSING_CREDENTIALS', 'Missing API credentials or base URL');
      }

      await axios.delete(`${baseUrl}/products/${productId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      await this.sendWebhook('product.deleted', { productId });

      await logToApi('info', `Product deleted from ${providerName}`, { productId });
    } catch (error) {
      await logToApi('error', 'Error deleting product', { productId, provider: this.integration.providerName }, error);
      throw error instanceof SellerError ? error : new SellerError('DELETE_FAILED', error instanceof Error ? error.message : 'Failed to delete product');
    }
  }
}

export default {
  getDynamicIntegrations,
  DynamicIntegrationService,
};
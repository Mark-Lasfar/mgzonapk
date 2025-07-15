import SellerIntegration, { ISellerIntegration } from '@/lib/db/models/seller-integration.model';
// import { logger } from '@/lib/utils';
import axios from 'axios';
import { ProductImportService } from '@/lib/api/services/product-import';
import { SellerError } from '@/lib/errors/seller-error';
import { logger } from '../logging';

// تعريف أنواع البيانات
interface IntegrationData {
  _id: string;
  type: 'warehouse' | 'payment' | 'shipping' | 'dropshipping' | 'advertising';
  status: string;
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
        status: si.status,
        providerName: integration.providerName,
        settings: integration.settings,
        logoUrl: integration.logoUrl,
        webhook: si.webhook,
      };
    });

    logger.info(`Fetched ${result.length} integrations for seller ${sellerId} (sandbox: ${sandbox})`);

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    logger.error('Error fetching integrations', { error, sellerId, sandbox });
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

  private async sendWebhook(event: string, payload: any) {
    const webhook = this.integration.webhook;
    if (webhook?.enabled && webhook.url) {
      try {
        await axios.post(
          webhook.url,
          {
            event,
            data: payload,
            timestamp: new Date().toISOString(),
          },
          {
            headers: webhook.secret ? { 'X-Webhook-Secret': webhook.secret } : {},
          }
        );
        logger.info(`Webhook sent for ${event}`, { url: webhook.url });
      } catch (error) {
        logger.error(`Failed to send webhook for ${event}`, { error, url: webhook.url });
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

      const productData = {
        sourceId: product.sourceId,
        name: product.title,
        description: product.description || '',
        price: product.price,
        countInStock: product.quantity,
        category: product.categories?.[0] || 'Uncategorized',
        images: product.images.map((img) => img.url),
        sku: product.sku,
        currency: product.currency,
        availability: product.availability,
        region: product.region,
      };

      await this.sendWebhook('product.imported', productData);

      logger.info(`Product imported from ${this.integration.providerName}`, {
        productId,
        sellerId,
        region,
      });

      return productData;
    } catch (error) {
      logger.error('Error importing product', {
        error,
        productId,
        sellerId,
        provider: this.integration.providerName,
      });
      throw error instanceof SellerError ? error : new SellerError('IMPORT_FAILED', error.message || 'Failed to import product');
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

      if (!apiKey || !baseUrl) {
        throw new SellerError('MISSING_CREDENTIALS', 'Missing API credentials or base URL');
      }

      await axios.post(
        `${baseUrl}/products`,
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

      logger.info(`Product created in warehouse ${providerName}`, { externalId: product.externalId });
    } catch (error) {
      logger.error('Error creating product in warehouse', { error, provider: this.integration.providerName });
      throw error instanceof SellerError ? error : new SellerError('CREATE_FAILED', error.message || 'Failed to create product');
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
        this.integration._id
      );

      await this.sendWebhook('product.synced', inventoryData);

      logger.info(`Inventory synced from ${this.integration.providerName}`, {
        productId,
        sellerId,
        quantity: inventoryData.quantity,
        availability: inventoryData.availability,
      });

      return inventoryData;
    } catch (error) {
      logger.error('Error syncing inventory', {
        error,
        productId,
        sellerId,
        provider: this.integration.providerName,
      });
      throw error instanceof SellerError ? error : new SellerError('SYNC_FAILED', error.message || 'Failed to sync inventory');
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

      logger.info(`Product updated in ${providerName}`, { productId, updates });
    } catch (error) {
      logger.error('Error updating product', { error, productId, provider: this.integration.providerName });
      throw error instanceof SellerError ? error : new SellerError('UPDATE_FAILED', error.message || 'Failed to update product');
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

      logger.info(`Product deleted from ${providerName}`, { productId });
    } catch (error) {
      logger.error('Error deleting product', { error, productId, provider: this.integration.providerName });
      throw error instanceof SellerError ? error : new SellerError('DELETE_FAILED', error.message || 'Failed to delete product');
    }
  }
}

// تصدير الدوال
export default {
  getDynamicIntegrations,
  DynamicIntegrationService,
};
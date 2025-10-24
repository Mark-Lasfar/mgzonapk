// /home/mark/Music/my-nextjs-project-clean/lib/api/services/product-import.ts
import { z } from 'zod';
import Product from '@/lib/db/models/product.model';
import Seller from '@/lib/db/models/seller.model';
import Integration, { IIntegration } from '@/lib/db/models/integration.model';
import SellerIntegration, { ISellerIntegration } from '@/lib/db/models/seller-integration.model';
import { SellerError } from '@/lib/errors/seller-error';
import { DynamicIntegrationService } from '@/lib/services/integrations';
import { MarketplaceProduct } from '@/lib/types/marketplace';
import { ProductImportSchema, validateProductImport } from '@/lib/validator/product.validator';
import crypto from 'crypto';

// دالة مساعدة لتسجيل الـ logs عبر API
async function logToApi(type: 'info' | 'error' | 'warn', message: string, meta: any, error?: string) {
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

export class ProductImportService {
  private async getIntegrationAndSellerIntegration(
    providerId: string,
    sellerId: string,
    type: IIntegration['type'] = 'dropshipping'
  ): Promise<{ integration: IIntegration; sellerIntegration: ISellerIntegration }> {
    const requestId = crypto.randomUUID();

    const seller = await Seller.findById(sellerId);
    if (!seller) {
      await logToApi('error', 'Seller not found', { requestId, sellerId, service: 'product-import' });
      throw new SellerError('SELLER_NOT_FOUND', 'Seller not found');
    }

    const integration = await Integration.findOne({ _id: providerId, type, isActive: true });
    if (!integration) {
      await logToApi('error', 'Integration not found', { requestId, providerId, sellerId, service: 'product-import' });
      throw new SellerError('INTEGRATION_NOT_FOUND', `Integration not found: ${providerId}`);
    }

    const sellerIntegration = await SellerIntegration.findOne({
      sellerId,
      integrationId: integration._id,
      isActive: true,
    });
    if (!sellerIntegration) {
      await logToApi('error', 'Seller integration not connected', { requestId, providerId, sellerId, service: 'product-import' });
      throw new SellerError('INTEGRATION_NOT_CONNECTED', `${integration.providerName} integration not connected`);
    }

    return { integration, sellerIntegration };
  }

  async importProduct(
    providerId: string,
    productId: string,
    sellerId: string,
    region: string = 'global'
  ): Promise<MarketplaceProduct> {
    const requestId = crypto.randomUUID();
    try {
      const { integration, sellerIntegration } = await this.getIntegrationAndSellerIntegration(providerId, sellerId);

      const service = new DynamicIntegrationService(
        {
          _id: integration._id.toString(),
          type: integration.type,
          status: sellerIntegration.status ?? 'connected', // Default to 'connected' if undefined
          providerName: integration.providerName,
          settings: integration.settings,
          logoUrl: integration.logoUrl,
          webhook: sellerIntegration.webhook,
        },
        sellerIntegration
      );

      const response = await service.importProduct(productId, sellerId, region);

      const validation = validateProductImport({
        productId: response.sourceId,
        title: response.name,
        description: response.description,
        price: response.price,
        images: response.images || [],
        sku: response.sku || `SKU-${response.sourceId}`,
        quantity: response.countInStock,
        sourceId: response.sourceId,
        currency: response.currency,
        availability: response.availability,
        categories: response.category ? [response.category] : ['Uncategorized'],
        region,
      });

      if (!validation.success) {
        const errorMessage = validation.error.issues.map((e) => e.message).join(', ');
        await logToApi('error', 'Invalid product data', {
          requestId,
          productId,
          sellerId,
          errors: validation.error.issues,
          service: 'product-import',
        });
        throw new SellerError('INVALID_PRODUCT_DATA', errorMessage);
      }

      const externalProduct = validation.data;

      const productData: Partial<MarketplaceProduct> = {
        title: externalProduct.title,
        description: externalProduct.description || 'No description provided',
        price: externalProduct.price,
        images: externalProduct.images?.map((url) => ({ url })) || [], // Handle undefined images
        sku: externalProduct.sku,
        quantity: externalProduct.quantity,
        sourceId: externalProduct.sourceId,
        createdBy: sellerId, // Use createdBy instead of sellerId
        status: 'pending',
        currency: externalProduct.currency,
        availability: externalProduct.availability,
        categories: externalProduct.categories,
        region: externalProduct.region,
        createdAt: new Date(),
      };

      const product = await Product.create(productData);

      // إرسال Webhook إذا كان مفعلاً
      if (sellerIntegration.webhook?.enabled && sellerIntegration.webhook.url) {
        await service.callApi({
          endpoint: sellerIntegration.webhook.url,
          method: 'POST',
          body: {
            event: 'product.created',
            data: productData,
            timestamp: new Date().toISOString(),
          },
        });
      }

      await logToApi('info', 'Product imported', {
        requestId,
        productId: product._id,
        sellerId,
        providerName: integration.providerName,
        region,
        currency: externalProduct.currency,
        service: 'product-import',
      });

      return product;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await logToApi('error', 'Failed to import product', {
        requestId,
        error: errorMessage,
        productId,
        sellerId,
        region,
        providerId,
        service: 'product-import',
      });
      throw new SellerError('IMPORT_FAILED', errorMessage);
    }
  }

  async updateProduct(
    providerId: string,
    productId: string,
    sellerId: string,
    region: string = 'global'
  ): Promise<MarketplaceProduct> {
    const requestId = crypto.randomUUID();
    try {
      const { integration, sellerIntegration } = await this.getIntegrationAndSellerIntegration(providerId, sellerId);

      const service = new DynamicIntegrationService(
        {
          _id: integration._id.toString(),
          type: integration.type,
          status: sellerIntegration.status ?? 'connected', // Default to 'connected' if undefined
          providerName: integration.providerName,
          settings: integration.settings,
          logoUrl: integration.logoUrl,
          webhook: sellerIntegration.webhook,
        },
        sellerIntegration
      );

      const product = await Product.findOne({ sourceId: productId, sellerId });
      if (!product) {
        await logToApi('error', 'Product not found in database', { requestId, productId, sellerId, service: 'product-import' });
        throw new SellerError('PRODUCT_NOT_FOUND', `Product with sourceId ${productId} not found`);
      }

      const response = await service.importProduct(productId, sellerId, region);

      const validation = validateProductImport({
        productId: response.sourceId,
        title: response.name,
        description: response.description,
        price: response.price,
        images: response.images || [],
        sku: response.sku || `SKU-${response.sourceId}`,
        quantity: response.countInStock,
        sourceId: response.sourceId,
        currency: response.currency,
        availability: response.availability,
        categories: response.category ? [response.category] : ['Uncategorized'],
        region,
      });

      if (!validation.success) {
        const errorMessage = validation.error.issues.map((e) => e.message).join(', ');
        await logToApi('error', 'Invalid product data', {
          requestId,
          productId,
          sellerId,
          errors: validation.error.issues,
          service: 'product-import',
        });
        throw new SellerError('INVALID_PRODUCT_DATA', errorMessage);
      }

      const externalProduct = validation.data;

      product.title = externalProduct.title;
      product.description = externalProduct.description || 'No description provided';
      product.price = externalProduct.price;
      product.images = externalProduct.images?.map((url) => ({ url })) || []; // Handle undefined images
      product.sku = externalProduct.sku;
      product.quantity = externalProduct.quantity;
      product.currency = externalProduct.currency;
      product.availability = externalProduct.availability;
      product.categories = externalProduct.categories;
      product.region = externalProduct.region;
      product.updatedAt = new Date();
      product.updatedBy = sellerId;

      await product.save();

      // إرسال Webhook إذا كان مفعلاً
      if (sellerIntegration.webhook?.enabled && sellerIntegration.webhook.url) {
        await service.callApi({
          endpoint: sellerIntegration.webhook.url,
          method: 'POST',
          body: {
            event: 'product.updated',
            data: {
              productId: product._id,
              sourceId: product.sourceId,
              title: product.title,
              price: product.price,
              quantity: product.quantity,
              availability: product.availability,
            },
            timestamp: new Date().toISOString(),
          },
        });
      }

      await logToApi('info', 'Product updated', {
        requestId,
        productId: product._id,
        sellerId,
        providerName: integration.providerName,
        region,
        currency: externalProduct.currency,
        service: 'product-import',
      });

      return product;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await logToApi('error', 'Failed to update product', {
        requestId,
        error: errorMessage,
        productId,
        sellerId,
        region,
        providerId,
        service: 'product-import',
      });
      throw new SellerError('UPDATE_FAILED', errorMessage);
    }
  }

  async handlePayment(
    productId: string,
    sellerId: string,
    paymentDetails: { token: string; amount: number; currency: string },
    paymentIntegrationId: string
  ) {
    const requestId = crypto.randomUUID();
    try {
      const { integration, sellerIntegration } = await this.getIntegrationAndSellerIntegration(
        paymentIntegrationId,
        sellerId,
        'payment'
      );

      const service = new DynamicIntegrationService(
        {
          _id: integration._id.toString(),
          type: integration.type,
          status: sellerIntegration.status ?? 'connected', // Default to 'connected' if undefined
          providerName: integration.providerName,
          settings: integration.settings,
          logoUrl: integration.logoUrl,
          webhook: sellerIntegration.webhook,
        },
        sellerIntegration
      );

      const supportedCurrencies = integration.settings.supportedCurrencies || ['USD'];
      if (!supportedCurrencies.includes(paymentDetails.currency)) {
        throw new SellerError('INVALID_CURRENCY', `Currency ${paymentDetails.currency} is not supported by ${integration.providerName}`);
      }

      const response = await service.callApi<{
        success: boolean;
        paymentId: string;
        status: string;
      }>({
        endpoint: integration.settings.endpoints?.get('createPayment') || '/payments',
        method: 'POST',
        body: {
          amount: paymentDetails.amount,
          currency: paymentDetails.currency,
          source: paymentDetails.token,
          description: `Payment for product ${productId}`,
          metadata: { sellerId, productId },
        },
      });

      // إرسال Webhook إذا كان مفعلاً
      if (sellerIntegration.webhook?.enabled && sellerIntegration.webhook.url) {
        await service.callApi({
          endpoint: sellerIntegration.webhook.url,
          method: 'POST',
          body: {
            event: 'payment.succeeded',
            data: {
              paymentId: response.paymentId,
              amount: paymentDetails.amount,
              currency: paymentDetails.currency,
              productId,
              sellerId,
            },
            timestamp: new Date().toISOString(),
          },
        });
      }

      await logToApi('info', 'Payment processed successfully', {
        requestId,
        productId,
        paymentId: response.paymentId,
        currency: paymentDetails.currency,
        service: 'product-import',
      });

      return { success: true, status: response.status, paymentId: response.paymentId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await logToApi('error', 'Failed to process payment', {
        requestId,
        error: errorMessage,
        productId,
        currency: paymentDetails.currency,
        service: 'product-import',
      });
      throw new SellerError('PAYMENT_FAILED', errorMessage);
    }
  }

  async syncInventory(productId: string, sellerId: string, providerId: string, region: string = 'global') {
    const requestId = crypto.randomUUID();
    try {
      const { integration, sellerIntegration } = await this.getIntegrationAndSellerIntegration(providerId, sellerId);

      const service = new DynamicIntegrationService(
        {
          _id: integration._id.toString(),
          type: integration.type,
          status: sellerIntegration.status ?? 'connected', // Default to 'connected' if undefined
          providerName: integration.providerName,
          settings: integration.settings,
          logoUrl: integration.logoUrl,
          webhook: sellerIntegration.webhook,
        },
        sellerIntegration
      );

      const response = await service.syncInventory(productId, sellerId);

      const product = await Product.findOne({ sourceId: productId, sellerId });
      if (product) {
        product.quantity = response.quantity;
        product.availability = response.availability;
        product.lastSyncedAt = new Date();
        await product.save();
      } else {
        await logToApi('warn', 'Product not found in database for inventory sync', {
          requestId,
          productId,
          sellerId,
          service: 'product-import',
        });
      }

      // إرسال Webhook إذا كان مفعلاً
      if (sellerIntegration.webhook?.enabled && sellerIntegration.webhook.url) {
        await service.callApi({
          endpoint: sellerIntegration.webhook.url,
          method: 'POST',
          body: {
            event: 'inventory.updated',
            data: {
              productId,
              quantity: response.quantity,
              availability: response.availability,
              sellerId,
            },
            timestamp: new Date().toISOString(),
          },
        });
      }

      await logToApi('info', 'Inventory synced', {
        requestId,
        productId,
        sellerId,
        providerName: integration.providerName,
        quantity: response.quantity,
        availability: response.availability,
        service: 'product-import',
      });

      return { success: true, quantity: response.quantity, availability: response.availability };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await logToApi('error', 'Failed to sync inventory', {
        requestId,
        error: errorMessage,
        productId,
        sellerId,
        providerId,
        service: 'product-import',
      });
      throw new SellerError('SYNC_FAILED', errorMessage);
    }
  }
}

export default new ProductImportService();
import { RedisClient } from './redis';
import { UnifiedWarehouseService } from '@/lib/services/warehouse/unified';
// import { logger } from '@/lib/utils';
// import { FulfillmentConfig, FulfillmentProvider } from '@/lib/types/fulfillment';
import { connectToDatabase } from '@/lib/db';
import Product from '@/lib/db/models/product.model';
import { logger } from './lib/services/logging';
// import { logger } from './lib/utils/logger';
// import { FulfillmentProvider } from './lib/api/types';
// import { FulfillmentProvider } from './lib/api/types/fulfillment';

export class InventoryFulfillmentService {
  private providers: Map<FulfillmentProvider, UnifiedWarehouseService> = new Map();

  constructor(configs: FulfillmentConfig[]) {
    configs.forEach((config) => {
      this.providers.set(
        config.provider,
        new UnifiedWarehouseService({
          provider: config.provider,
          apiKey: config.apiKey,
          apiUrl: config.apiUrl || `https://api.${config.provider.toLowerCase()}.com`,
          apiSecret: config.apiSecret,
        })
      );
    });
    logger.info('InventoryFulfillmentService initialized', { providers: Array.from(this.providers.keys()) });
  }

  async syncInventory(provider: FulfillmentProvider, productId?: string) {
    const service = this.providers.get(provider);
    if (!service) {
      throw new Error(`Provider ${provider} not configured`);
    }

    try {
      await connectToDatabase();

      if (productId) {
        const inventory = await service.getInventory(productId);
        await RedisClient.set(`inventory:${provider}:${productId}`, inventory, 3600);
        await this.updateProductInventory(productId, inventory);
        logger.info('Inventory synced for product', { provider, productId });
        return { success: true, data: inventory };
      } else {
        const products = await Product.find({ 'warehouse.provider': provider });
        const results = await Promise.all(
          products.map(async (product) => {
            const inventory = await service.getInventory(product._id.toString());
            await RedisClient.set(`inventory:${provider}:${product._id}`, inventory, 3600);
            await this.updateProductInventory(product._id.toString(), inventory);
            return inventory;
          })
        );
        logger.info('Inventory synced for all products', { provider, count: results.length });
        return { success: true, data: results };
      }
    } catch (error) {
      logger.error('Inventory sync failed', { provider, productId, error });
      throw error;
    }
  }

  async processOrder(orderId: string, options: { provider: FulfillmentProvider; priority?: string }) {
    const service = this.providers.get(options.provider);
    if (!service) {
      throw new Error(`Provider ${options.provider} not configured`);
    }

    try {
      // Simulate order processing
      const shipment = await service.createShipment({
        orderId,
        items: [], // يحتاج بيانات الطلب الفعلية
        shippingAddress: {}, // يحتاج عنوان الشحن
      });
      await RedisClient.set(`order:${orderId}:shipment`, shipment, 86400);
      logger.info('Order processed', { orderId, provider: options.provider, trackingId: shipment.trackingId });
      return { success: true, data: shipment };
    } catch (error) {
      logger.error('Order processing failed', { orderId, provider: options.provider, error });
      throw error;
    }
  }

  private async updateProductInventory(productId: string, inventory: any) {
    try {
      await connectToDatabase();
      const product = await Product.findById(productId);
      if (!product) {
        throw new Error('Product not found');
      }

      const warehouseIndex = product.warehouseData.findIndex(
        (wh: any) => wh.warehouseId === inventory.warehouseId
      );

      if (warehouseIndex !== -1) {
        product.warehouseData[warehouseIndex].quantity = inventory.quantity;
        product.warehouseData[warehouseIndex].location = inventory.location;
        product.warehouseData[warehouseIndex].lastSync = new Date();
      }

      product.countInStock = product.warehouseData.reduce((sum: number, wh: any) => sum + wh.quantity, 0);
      product.inventoryStatus =
        product.countInStock === 0
          ? 'OUT_OF_STOCK'
          : product.countInStock <= Math.min(...product.warehouseData.map((wh: any) => wh.minimumStock))
          ? 'LOW_STOCK'
          : 'IN_STOCK';

      await product.save();
      logger.info('Product inventory updated in database', { productId });
    } catch (error) {
      logger.error('Failed to update product inventory in database', { productId, error });
      throw error;
    }
  }
}
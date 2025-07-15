import { Redis } from '@upstash/redis';
import { logger } from './logging';
import { ObservabilityService } from './observability';
import { InventoryItem, InventorySync, InventoryAdjustment } from '../types/inventory';
import { WebhookDispatcher } from '../webhook-dispatcher';
import InventoryModel from '@/lib/db/models/inventory.model';
import Product from '@/lib/db/models/product.model';
import { FulfillmentConfig, FulfillmentProvider } from '../types/fulfillment';
import { ShipBobService } from '../integrations/shipbob/service';
import { AmazonFBAService } from '../integrations/amazon/service';
import { connectToDatabase } from '@/lib/db';
import { auth } from '@/auth';

export class AdvancedInventorySyncService {
  private redis: Redis;
  private fulfillmentProviders: Map<FulfillmentProvider, any> = new Map();
  private observabilityService: ObservabilityService;

  constructor(configs: FulfillmentConfig[]) {
    this.redis = Redis.fromEnv();
    this.observabilityService = ObservabilityService.getInstance();
    this.initializeFulfillmentProviders(configs);
  }

  private async getCurrentUser(): Promise<string> {
    const session = await auth();
    return session?.user?.id || 'system';
  }

  private initializeFulfillmentProviders(configs: FulfillmentConfig[]) {
    configs.forEach((config) => {
      switch (config.provider) {
        case 'shipbob':
          this.fulfillmentProviders.set(
            config.provider,
            new ShipBobService({
              apiKey: config.apiKey,
              apiUrl: process.env.SHIPBOB_API_URL || 'https://api.shipbob.com',
            })
          );
          break;
        case 'amazon':
          this.fulfillmentProviders.set(config.provider, new AmazonFBAService(config));
          break;
        default:
          logger.warn('Unknown provider', {
            provider: config.provider,
            timestamp: new Date().toISOString(),
          });
      }
    });
  }

  private async loadProviderConfigs(): Promise<FulfillmentConfig[]> {
    const configs: FulfillmentConfig[] = [];
    const currentUser = await this.getCurrentUser();
    const timestamp = new Date().toISOString();

    if (process.env.SHIPBOB_API_KEY) {
      configs.push({
        provider: 'shipbob',
        apiKey: process.env.SHIPBOB_API_KEY,
        sandbox: process.env.NODE_ENV !== 'production',
        createdAt: timestamp,
        createdBy: currentUser,
        updatedAt: timestamp,
        updatedBy: currentUser,
      });
    }

    if (process.env.AMAZON_REFRESH_TOKEN) {
      configs.push({
        provider: 'amazon',
        region: process.env.AMAZON_REGION || 'na',
        credentials: {
          refreshToken: process.env.AMAZON_REFRESH_TOKEN,
          clientId: process.env.AMAZON_CLIENT_ID,
          clientSecret: process.env.AMAZON_CLIENT_SECRET,
          awsAccessKey: process.env.AMAZON_AWS_ACCESS_KEY,
          awsSecretKey: process.env.AMAZON_AWS_SECRET_KEY,
          roleArn: process.env.AMAZON_ROLE_ARN,
        },
        createdAt: timestamp,
        createdBy: currentUser,
        updatedAt: timestamp,
        updatedBy: currentUser,
      });
    }

    return configs;
  }

  private async getProvider(provider: FulfillmentProvider) {
    const providerService = this.fulfillmentProviders.get(provider);
    if (!providerService) {
      throw new Error(`Fulfillment provider ${provider} not configured`);
    }
    return providerService;
  }

  async syncInventory(provider: FulfillmentProvider) {
    const service = await this.getProvider(provider);
    const currentUser = await this.getCurrentUser();
    const timestamp = new Date().toISOString();

    try {
      await connectToDatabase();
      const inventoryLevels = await service.getInventory();

      await this.redis.set(`inventory:${provider}`, JSON.stringify(inventoryLevels), { EX: 3600 });

      await this.syncWithDatabase(inventoryLevels);

      await this.observabilityService.recordMetric({
        name: 'inventory.sync',
        value: 1,
        timestamp: new Date(),
        tags: { provider },
      });

      logger.info('Inventory synced successfully', {
        provider,
        timestamp,
        user: currentUser,
      });

      return {
        success: true,
        data: inventoryLevels,
        timestamp,
        user: currentUser,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.observabilityService.recordError({
        error: errorMessage,
        context: { provider },
        timestamp: new Date(),
      });
      logger.error('Inventory sync failed', {
        provider,
        error: errorMessage,
        timestamp,
        user: currentUser,
      });
      throw error;
    }
  }

  private async syncWithDatabase(inventoryLevels: any[]) {
    try {
      await connectToDatabase();
      for (const level of inventoryLevels) {
        await Product.updateOne(
          { 'warehouseData.sku': level.sku },
          {
            $set: {
              'warehouseData.$.quantity': level.quantity,
              'warehouseData.$.lastUpdated': new Date(),
            },
          },
          { upsert: true }
        );
      }
      logger.info('Inventory synced with database', {
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.observabilityService.recordError({
        error: errorMessage,
        context: { inventoryLevels },
        timestamp: new Date(),
      });
      logger.error('Failed to sync inventory with database', {
        error: errorMessage,
        timestamp: new Date().toISOString(),
      });
    }
  }

  async getInventory(provider: FulfillmentProvider) {
    const service = await this.getProvider(provider);
    const currentUser = await this.getCurrentUser();
    const timestamp = new Date().toISOString();

    try {
      const cachedInventory = await this.redis.get(`inventory:${provider}`);
      if (cachedInventory) {
        return {
          success: true,
          data: JSON.parse(cachedInventory),
          cached: true,
          timestamp,
          requestedBy: currentUser,
        };
      }

      const inventoryLevels = await service.getInventory();

      await this.redis.set(`inventory:${provider}`, JSON.stringify(inventoryLevels), { EX: 3600 });

      await this.observabilityService.recordMetric({
        name: 'inventory.get',
        value: 1,
        timestamp: new Date(),
        tags: { provider },
      });

      return {
        success: true,
        data: inventoryLevels,
        cached: false,
        timestamp,
        requestedBy: currentUser,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.observabilityService.recordError({
        error: errorMessage,
        context: { provider },
        timestamp: new Date(),
      });
      logger.error('Get inventory failed', {
        provider,
        error: errorMessage,
        timestamp,
        user: currentUser,
      });
      throw error;
    }
  }

  private async updateSyncStatus(syncId: string, status: InventorySync['status']) {
    const sync = await this.getSyncState(syncId);
    if (!sync) return;

    sync.status = status;
    if (status === 'completed' || status === 'failed') {
      sync.completedAt = new Date();
    }

    await this.redis.set(`inventory-sync:${syncId}`, JSON.stringify(sync));
  }

  private async updateSyncProgress(syncId: string, itemsProcessed: number, totalItems?: number) {
    const sync = await this.getSyncState(syncId);
    if (!sync) return;

    sync.itemsProcessed = itemsProcessed;
    if (totalItems !== undefined) {
      sync.totalItems = totalItems;
    }

    await this.redis.set(`inventory-sync:${syncId}`, JSON.stringify(sync));
  }

  private async recordSyncError(syncId: string, sku: string, error: string) {
    const sync = await this.getSyncState(syncId);
    if (!sync) return;

    sync.errors.push({
      sku,
      error,
      timestamp: new Date(),
    });

    await this.redis.set(`inventory-sync:${syncId}`, JSON.stringify(sync));
  }

  private async getSyncState(syncId: string): Promise<InventorySync | null> {
    const data = await this.redis.get(`inventory-sync:${syncId}`);
    return data ? JSON.parse(data) : null;
  }

  private async sendLowStockAlert(item: InventoryItem) {
    try {
      await WebhookDispatcher.dispatch('system', 'inventory.low_stock', {
        sku: item.sku,
        quantity: item.quantity,
        threshold: item.thresholds.low,
        provider: item.provider,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.observabilityService.recordError({
        error: errorMessage,
        context: { sku: item.sku },
        timestamp: new Date(),
      });
    }
  }

  async adjustInventory(adjustment: InventoryAdjustment) {
    try {
      await connectToDatabase();
      const item = await InventoryModel.findOne({ sku: adjustment.sku });
      if (!item) {
        throw new Error(`Item with SKU ${adjustment.sku} not found`);
      }

      let newQuantity: number;
      switch (adjustment.type) {
        case 'increase':
          newQuantity = item.quantity + adjustment.quantity;
          break;
        case 'decrease':
          newQuantity = item.quantity - adjustment.quantity;
          if (newQuantity < 0) {
            throw new Error('Insufficient inventory');
          }
          break;
        case 'set':
          newQuantity = adjustment.quantity;
          break;
      }

      const updatedItem = await InventoryModel.findByIdAndUpdate(
        item._id,
        {
          quantity: newQuantity,
          updatedAt: new Date(),
          $push: {
            adjustments: {
              type: adjustment.type,
              quantity: adjustment.quantity,
              reason: adjustment.reason,
              createdAt: new Date(),
            },
          },
        },
        { new: true }
      );

      await this.observabilityService.recordMetric({
        name: 'inventory.adjusted',
        value: adjustment.quantity,
        timestamp: new Date(),
        tags: { sku: adjustment.sku },
      });

      return updatedItem;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.observabilityService.recordError({
        error: errorMessage,
        context: { sku: adjustment.sku },
        timestamp: new Date(),
      });
      throw error;
    }
  }
}
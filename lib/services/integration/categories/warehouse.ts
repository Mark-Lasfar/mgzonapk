import { IntegrationService } from '../base';
import { CreateShipmentRequest, ShipmentStatus, WarehouseProduct, CreateProductRequest, UpdateProductRequest } from '@/lib/services/warehouse/types';
import { logger } from '@/lib/api/services/logging';

export class WarehouseIntegration extends IntegrationService {
  async createShipment(request: CreateShipmentRequest): Promise<{ trackingId: string }> {
    try {
      return await super.createShipment(request);
    } catch (error) {
      logger.error('Failed to create shipment', { error, provider: this.integration.providerName });
      throw error;
    }
  }

  async getShipmentStatus(trackingId: string): Promise<ShipmentStatus> {
    try {
      return await super.getShipmentStatus(trackingId);
    } catch (error) {
      logger.error('Failed to get shipment status', { error, provider: this.integration.providerName });
      throw error;
    }
  }

  async syncInventory(productId?: string): Promise<WarehouseProduct | WarehouseProduct[]> {
    try {
      return await super.syncInventor(productId);
    } catch (error) {
      logger.error('Failed to sync inventory', { error, provider: this.integration.providerName });
      throw error;
    }
  }

  async updateInventory(productId: string, quantity: number): Promise<void> {
    try {
      return await super.updateInventory(productId, quantity);
    } catch (error) {
      logger.error('Failed to update inventory', { error, provider: this.integration.providerName });
      throw error;
    }
  }

  async createProduct(request: CreateProductRequest): Promise<{ id: string }> {
    try {
      return await super.createProduct(request);
    } catch (error) {
      logger.error('Failed to create product', { error, provider: this.integration.providerName });
      throw error;
    }
  }

  async updateProduct(request: UpdateProductRequest): Promise<void> {
    try {
      return await super.updateProduct(request);
    } catch (error) {
      logger.error('Failed to update product', { error, provider: this.integration.providerName });
      throw error;
    }
  }
}
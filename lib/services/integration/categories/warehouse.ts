// /lib/services/integration/categories/warehouse.ts
import { IntegrationService } from '../base';
import { CreateShipmentRequest, ShipmentStatus, WarehouseProduct, CreateProductRequest, UpdateProductRequest } from '@/lib/services/warehouse/types';
import { logger } from '@/lib/api/services/logging';
import axios from 'axios';

export class WarehouseIntegration extends IntegrationService {
  async createShipment(request: CreateShipmentRequest): Promise<{ trackingId: string }> {
    try {
      const response = await axios.post<{ trackingId: string }>(
        `${this.baseUrl}/shipments`,
        request,
        { headers: this.headers }
      );
      logger.info('Shipment created', { provider: this.integration.providerName, trackingId: response

.data.trackingId });
      return response.data;
    } catch (error) {
      logger.error('Failed to create shipment', { error, provider: this.integration.providerName });
      throw error;
    }
  }





  async getShipmentStatus(trackingId: string): Promise<ShipmentStatus> {
    try {
      const response = await axios.get<ShipmentStatus>(
        `${this.baseUrl}/shipments/${trackingId}`,
        { headers: this.headers }
      );
      logger.info('Shipment status retrieved', { provider: this.integration.providerName, trackingId });
      return response.data;
    } catch (error) {
      logger.error('Failed to get shipment status', { error, provider: this.integration.providerName });
      throw error;
    }
  }

  async getInventory(request: { sku: string }): Promise<WarehouseProduct> {
    try {
      const response = await axios.get<WarehouseProduct>(
        `${this.baseUrl}/inventory/${request.sku}`,
        { headers: this.headers }
      );
      logger.info('Inventory retrieved', { provider: this.integration.providerName, sku: request.sku });
      return response.data;
    } catch (error) {
      logger.error('Failed to get inventory', { error, provider: this.integration.providerName });
      throw error;
    }
  }

  async updateInventory(productId: string, quantity: number): Promise<void> {
    try {
      await axios.put(
        `${this.baseUrl}/inventory/${productId}`,
        { quantity },
        { headers: this.headers }
      );
      logger.info('Inventory updated', { provider: this.integration.providerName, productId });
    } catch (error) {
      logger.error('Failed to update inventory', { error, provider: this.integration.providerName });
      throw error;
    }
  }

  async createProduct(request: CreateProductRequest): Promise<{ id: string }> {
    try {
      const response = await axios.post<{ id: string }>(
        `${this.baseUrl}/products`,
        request,
        { headers: this.headers }
      );
      logger.info('Product created', { provider: this.integration.providerName, productId: response.data.id });
      return response.data;
    } catch (error) {
      logger.error('Failed to create product', { error, provider: this.integration.providerName });
      throw error;
    }
  }

  async updateProduct(request: UpdateProductRequest): Promise<void> {
    try {
      await axios.put(
        `${this.baseUrl}/products/${request.externalId}`,
        request,
        { headers: this.headers }
      );
      logger.info('Product updated', { provider: this.integration.providerName, externalId: request.externalId });
    } catch (error) {
      logger.error('Failed to update product', { error, provider: this.integration.providerName });
      throw error;
    }
  }

    async deleteProduct(request: { externalId: string }): Promise<void> {
    try {
      await axios.delete(`${this.baseUrl}/products/${request.externalId}`, {
        headers: this.headers,
      });
      logger.info('Product deleted', { provider: this.integration.providerName, externalId: request.externalId });
    } catch (error) {
      logger.error('Failed to delete product', { error, provider: this.integration.providerName });
      throw error;
    }
  }
}

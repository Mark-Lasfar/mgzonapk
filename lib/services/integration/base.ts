import axios from 'axios';
import { IIntegration } from '@/lib/db/models/integration.model';
import { logger } from '@/lib/api/services/logging';
import { CreateShipmentRequest, ShipmentStatus, WarehouseProduct, CreateProductRequest, UpdateProductRequest } from '@/lib/services/warehouse/types';
import { FulfillmentOrder, FulfillmentResult } from '@/lib/api/types/fulfillment';
import { SellerIntegration } from '@/lib/db/models/seller-integration.model';
import Seller from '@/lib/db/models/seller.model';
import { encrypt, decrypt } from '@/lib/utils/encryption';

export class IntegrationService {
  protected integration: IIntegration;
  protected baseUrl: string;
  protected headers: Record<string, string>;

  constructor(integrationId: string) {
    this.integration = {} as IIntegration;
    this.baseUrl = '';
    this.headers = {
      'Content-Type': 'application/json',
    };
    this.loadIntegration(integrationId);
  }

  private async loadIntegration(integrationId: string) {
    const Integration = (await import('@/lib/db/models/integration.model')).default;
    this.integration = await Integration.findById(integrationId).lean();
    if (!this.integration || !this.integration.isActive) {
      throw new Error('Integration not found or inactive');
    }

    this.baseUrl = this.integration.baseUrl || '';
    if (this.integration.accessToken) {
      this.headers['Authorization'] = `Bearer ${decrypt(this.integration.accessToken)}`;
    }
    if (this.integration.apiKey) {
      this.headers['X-Api-Key'] = decrypt(this.integration.apiKey);
    }
  }

  private async validateSellerIntegration(sellerId: string, providerName: string): Promise<void> {
    const seller = await Seller.findById(sellerId);
    if (!seller) {
      throw new Error('Seller not found');
    }
    const integration = seller.integrations.get(providerName);
    if (!integration || !integration.isActive) {
      throw new Error(`Integration ${providerName} not active for seller ${sellerId}`);
    }
  }

  async refreshAccessToken(sellerIntegration: SellerIntegration): Promise<void> {
    if (!this.integration.refreshTokenUrl || !sellerIntegration.refreshToken) {
      throw new Error('Refresh token or URL not configured');
    }

    try {
      const response = await axios.post(
        this.integration.refreshTokenUrl,
        {
          refresh_token: decrypt(sellerIntegration.refreshToken),
          client_id: this.integration.clientId,
          client_secret: decrypt(this.integration.clientSecret || ''),
          grant_type: 'refresh_token',
        },
        { headers: this.headers }
      );

      const { access_token, refresh_token, expires_in } = response.data;
      sellerIntegration.accessToken = encrypt(access_token);
      if (refresh_token) {
        sellerIntegration.refreshToken = encrypt(refresh_token);
      }
      sellerIntegration.expiresAt = new Date(Date.now() + expires_in * 1000);
      sellerIntegration.lastUpdatedAt = new Date();
      await sellerIntegration.save();

      this.headers['Authorization'] = `Bearer ${access_token}`;
      logger.info('Access token refreshed', {
        integrationId: this.integration._id,
        provider: this.integration.providerName,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Failed to refresh access token', {
        integrationId: this.integration._id,
        provider: this.integration.providerName,
        error: errorMessage,
      });
      throw error;
    }
  }

  async validateCredentials(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/test`, { headers: this.headers });
      return response.status >= 200 && response.status < 300;
    } catch (error) {
      logger.error('Credential validation failed', {
        integrationId: this.integration._id,
        provider: this.integration.providerName,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async handleWebhookEvent(sellerId: string, event: string, payload: any): Promise<void> {
    await this.validateSellerIntegration(sellerId, this.integration.providerName);
    const seller = await Seller.findById(sellerId);
    if (!seller) throw new Error('Seller not found');

    switch (this.integration.type) {
      case 'warehouse':
        if (event === 'inventory.updated') {
          await this.updateInventory(seller, payload);
        }
        break;
      case 'payment':
        if (event === 'payment.succeeded') {
          await this.processPayment(seller, payload);
        }
        break;
      case 'dropshipping':
        if (event === 'order.fulfilled') {
          await this.fulfillOrder(seller, payload);
        }
        break;
      case 'marketplace':
        if (event === 'order.created') {
          await this.createOrder(seller, payload);
        }
        break;
      case 'shipping':
        if (event === 'shipment.updated') {
          await this.updateShipment(seller, payload);
        }
        break;
      case 'marketing':
      case 'advertising':
        if (event === 'campaign.updated' || event === 'ad.performance.updated') {
          await this.updateMarketingMetrics(seller, payload);
        }
        break;
      case 'accounting':
        if (event === 'transaction.recorded') {
          await this.recordTransaction(seller, payload);
        }
        break;
      case 'crm':
        if (event === 'customer.updated') {
          await this.updateCustomer(seller, payload);
        }
        break;
      case 'analytics':
        if (event === 'analytics.updated') {
          await this.updateAnalytics(seller, payload);
        }
        break;
      case 'automation':
        if (event === 'automation.triggered') {
          await this.triggerAutomation(seller, payload);
        }
        break;
      case 'communication':
        if (event === 'message.sent') {
          await this.processCommunication(seller, payload);
        }
        break;
      case 'education':
        if (event === 'course.updated') {
          await this.updateCourse(seller, payload);
        }
        break;
      case 'security':
        if (event === 'security.alert') {
          await this.handleSecurityAlert(seller, payload);
        }
        break;
      case 'tax':
        if (event === 'tax.transaction.created') {
          await this.processTaxTransaction(seller, payload);
        }
        break;
      case 'other':
        await this.handleCustomEvent(seller, payload);
        break;
      default:
        logger.warn('Unsupported integration type', { type: this.integration.type });
    }
  }

  private async updateInventory(seller: any, payload: WarehouseProduct) {
    seller.metrics.products.total = payload.totalCount || seller.metrics.products.total;
    seller.metrics.products.outOfStock = payload.outOfStockCount || seller.metrics.products.outOfStock;
    await seller.save();
    logger.info('Inventory updated', { sellerId: seller._id, provider: this.integration.providerName });
  }

  private async processPayment(seller: any, payload: any) {
    const Order = (await import('@/lib/db/models/order.model')).default;
    const order = await Order.findOne({ sellerId: seller._id, paymentGatewayId: payload.paymentId });
    if (order) {
      order.paymentStatus = 'successful';
      order.status = 'processing';
      order.escrowStatus = 'held';
      order.escrowDetails = {
        chargeId: payload.paymentId,
        releaseDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };
      await order.save();
      logger.info('Payment processed', { orderId: order._id, sellerId: seller._id });
    }
  }

  private async fulfillOrder(seller: any, payload: FulfillmentOrder) {
    const Order = (await import('@/lib/db/models/order.model')).default;
    const order = await Order.findOne({ sellerId: seller._id, _id: payload.orderId });
    if (order) {
      order.fulfillmentStatus = 'fulfilled';
      order.status = 'completed';
      order.trackingInfo = {
        trackingNumber: payload.trackingNumber,
        carrier: payload.carrier,
        lastUpdated: new Date().toISOString(),
      };
      await order.save();
      logger.info('Order fulfilled', { orderId: order._id, sellerId: seller._id });
    }
  }

  private async createOrder(seller: any, payload: any) {
    const Order = (await import('@/lib/db/models/order.model')).default;
    const order = new Order({
      sellerId: seller._id,
      externalOrderId: payload.orderId,
      items: payload.items,
      totalAmount: payload.totalAmount,
      currency: payload.currency || 'USD',
      status: 'pending',
      paymentStatus: 'pending',
      createdAt: new Date(),
    });
    await order.save();
    logger.info('Order created', { orderId: order._id, sellerId: seller._id });
  }

  private async updateShipment(seller: any, payload: ShipmentStatus) {
    const Order = (await import('@/lib/db/models/order.model')).default;
    const order = await Order.findOne({ sellerId: seller._id, 'trackingInfo.trackingNumber': payload.trackingId });
    if (order) {
      order.fulfillmentStatus = payload.status;
      order.trackingInfo = {
        ...order.trackingInfo,
        status: payload.status,
        statusDetails: payload.statusDetails,
        lastUpdated: new Date().toISOString(),
      };
      await order.save();
      logger.info('Shipment updated', { orderId: order._id, sellerId: seller._id });
    }
  }

  private async updateMarketingMetrics(seller: any, payload: any) {
    seller.metrics.views += payload.impressions || 0;
    seller.metrics.viewsHistory.push({ date: new Date() });
    await seller.save();
    logger.info('Marketing metrics updated', { sellerId: seller._id, provider: this.integration.providerName });
  }

  private async recordTransaction(seller: any, payload: any) {
    seller.metrics.totalRevenue += payload.amount || 0;
    seller.metrics.totalSalesHistory.push({ amount: payload.amount, date: new Date() });
    await seller.save();
    logger.info('Transaction recorded', { sellerId: seller._id, provider: this.integration.providerName });
  }

  private async updateCustomer(seller: any, payload: any) {
    seller.metrics.customersCount = payload.customerCount || seller.metrics.customersCount;
    await seller.save();
    logger.info('Customer updated', { sellerId: seller._id, provider: this.integration.providerName });
  }

  private async updateAnalytics(seller: any, payload: any) {
    seller.metrics.views += payload.pageViews || 0;
    seller.metrics.viewsHistory.push({ date: new Date() });
    seller.metrics.customersCount = payload.uniqueVisitors || seller.metrics.customersCount;
    await seller.save();
    logger.info('Analytics updated', { sellerId: seller._id, provider: this.integration.providerName });
  }

  private async triggerAutomation(seller: any, payload: any) {
    logger.info('Automation triggered', { sellerId: seller._id, automationId: payload.automationId });
  }

  private async processCommunication(seller: any, payload: any) {
    seller.metrics.customersCount = payload.recipientCount || seller.metrics.customersCount;
    await seller.save();
    logger.info('Communication processed', { sellerId: seller._id, provider: this.integration.providerName });
  }

  private async updateCourse(seller: any, payload: any) {
    logger.info('Course updated', { sellerId: seller._id, courseId: payload.courseId });
  }

  private async handleSecurityAlert(seller: any, payload: any) {
    seller.metrics.integrationErrors = seller.metrics.integrationErrors || [];
    seller.metrics.integrationErrors.push({
      providerName: this.integration.providerName,
      errorCode: payload.errorCode || 'SECURITY_ALERT',
      message: payload.message || 'Security alert received',
      timestamp: new Date(),
    });
    await seller.save();
    logger.info('Security alert processed', { sellerId: seller._id, alertId: payload.alertId });
  }

  private async processTaxTransaction(seller: any, payload: any) {
    const Order = (await import('@/lib/db/models/order.model')).default;
    const order = await Order.findOne({ sellerId: seller._id, _id: payload.orderId });
    if (order) {
      order.taxDetails.transactionId = payload.transactionId;
      order.taxAmount = payload.taxAmount;
      order.taxDetails.taxType = payload.taxType || order.taxDetails.taxType;
      order.taxDetails.taxRate = payload.taxRate || order.taxDetails.taxRate;
      await order.save();
      logger.info('Tax transaction processed', { orderId: order._id, sellerId: seller._id });
    }
  }

  private async handleCustomEvent(seller: any, payload: any) {
    logger.info('Custom event processed', { sellerId: seller._id, provider: this.integration.providerName, event: payload.event });
  }

  async createProduct(sellerId: string, productData: CreateProductRequest): Promise<void> {
    await this.validateSellerIntegration(sellerId, this.integration.providerName);
    if (this.integration.type !== 'warehouse' && this.integration.type !== 'dropshipping') {
      throw new Error('Product creation not supported for this integration type');
    }
    try {
      const response = await axios.post(`${this.baseUrl}/products`, productData, { headers: this.headers });
      logger.info('Product created', { provider: this.integration.providerName, productId: response.data.id });
    } catch (error) {
      logger.error('Failed to create product', {
        provider: this.integration.providerName,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async updateProduct(sellerId: string, productId: string, productData: UpdateProductRequest): Promise<void> {
    await this.validateSellerIntegration(sellerId, this.integration.providerName);
    if (this.integration.type !== 'warehouse' && this.integration.type !== 'dropshipping') {
      throw new Error('Product update not supported for this integration type');
    }
    try {
      await axios.put(`${this.baseUrl}/products/${productId}`, productData, { headers: this.headers });
      logger.info('Product updated', { provider: this.integration.providerName, productId });
    } catch (error) {
      logger.error('Failed to update product', {
        provider: this.integration.providerName,
        productId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async createShipment(sellerId: string, shipmentData: CreateShipmentRequest): Promise<void> {
    await this.validateSellerIntegration(sellerId, this.integration.providerName);
    if (this.integration.type !== 'shipping') {
      throw new Error('Shipment creation not supported for this integration type');
    }
    try {
      const response = await axios.post(`${this.baseUrl}/shipments`, shipmentData, { headers: this.headers });
      logger.info('Shipment created', { provider: this.integration.providerName, shipmentId: response.data.id });
    } catch (error) {
      logger.error('Failed to create shipment', {
        provider: this.integration.providerName,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async getShipmentStatus(sellerId: string, shipmentId: string): Promise<ShipmentStatus> {
    await this.validateSellerIntegration(sellerId, this.integration.providerName);
    if (this.integration.type !== 'shipping') {
      throw new Error('Shipment status not supported for this integration type');
    }
    try {
      const response = await axios.get(`${this.baseUrl}/shipments/${shipmentId}`, { headers: this.headers });
      return response.data;
    } catch (error) {
      logger.error('Failed to get shipment status', {
        provider: this.integration.providerName,
        shipmentId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
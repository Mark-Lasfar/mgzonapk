import Integration, { IIntegration } from '@/lib/db/models/integration.model';
import SellerIntegration, { ISellerIntegration } from '@/lib/db/models/seller-integration.model';
import { customLogger } from './logging';
import { GenericIntegrationService } from './generic-integration';
import { SellerError } from '@/lib/errors/seller-error';
import Seller from '@/lib/db/models/seller.model';
import { v4 as uuidv4 } from 'uuid'; // استيراد uuid

export interface AnalyticsEvent {
  eventName: string;
  userId?: string;
  properties?: Record<string, any>;
  timestamp?: string;
}

export interface AnalyticsQuery {
  metric: string;
  startDate?: string;
  endDate?: string;
  filters?: Record<string, any>;
}

export class AnalyticsService {
  async trackEvent(
    providerId: string,
    sellerId: string,
    event: AnalyticsEvent
  ) {
    const requestId = uuidv4();
    try {
      const { integration, sellerIntegration } = await this.getIntegrationAndSellerIntegration(
        providerId,
        sellerId,
        'analytics'
      );
      const service = new GenericIntegrationService(integration, sellerIntegration);
      const response = await service.callApi({
        endpoint: integration.settings.endpoints?.get('trackEvent') || '/events',
        method: 'POST',
        body: {
          eventName: event.eventName,
          userId: event.userId,
          properties: event.properties,
          timestamp: event.timestamp || new Date().toISOString(),
        },
        webhookEvent: 'analytics.event.tracked',
      });

      await customLogger.info('Analytics event tracking successful', {
        requestId,
        provider: integration.providerName,
        eventName: event.eventName,
        userId: event.userId,
        service: 'analytics',
      });

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await customLogger.error('Failed to track analytics event', {
        requestId,
        eventName: event.eventName,
        error: errorMessage,
        providerId,
        sellerId,
        service: 'analytics',
      });
      throw new SellerError('ANALYTICS_FAILED', `Failed to track event: ${errorMessage}`);
    }
  }

  async getMetrics(
    providerId: string,
    sellerId: string,
    query: AnalyticsQuery
  ): Promise<any> {
    const requestId = uuidv4();
    try {
      const { integration, sellerIntegration } = await this.getIntegrationAndSellerIntegration(
        providerId,
        sellerId,
        'analytics'
      );
      const service = new GenericIntegrationService(integration, sellerIntegration);
      const response = await service.callApi({
        endpoint: integration.settings.endpoints?.get('metrics') || '/metrics',
        method: 'GET',
        params: {
          metric: query.metric,
          startDate: query.startDate,
          endDate: query.endDate,
          filters: query.filters,
        },
        webhookEvent: 'analytics.metrics.fetched',
      });

      await customLogger.info('Analytics metrics fetched successfully', {
        requestId,
        provider: integration.providerName,
        metric: query.metric,
        service: 'analytics',
      });

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await customLogger.error('Failed to fetch analytics metrics', {
        requestId,
        metric: query.metric,
        error: errorMessage,
        providerId,
        sellerId,
        service: 'analytics',
      });
      throw new SellerError('METRICS_FAILED', `Failed to fetch metrics: ${errorMessage}`);
    }
  }

  private async getIntegrationAndSellerIntegration(
    providerId: string,
    sellerId: any,
    type: string = 'analytics'
  ): Promise<{ integration: IIntegration; sellerIntegration: ISellerIntegration}> {
    const requestId = uuidv4();
    const seller = await Seller.findById(sellerId);
    if (!seller) {
      throw new SellerError('SELLER_NOT_FOUND', 'Seller not found');
    }
    const integration = await Integration.findOne({ _id: providerId, type, isActive: true });
    if (!integration) {
      throw new SellerError('INTEGRATION_NOT_FOUND', `Integration not found: ${providerId}`);
    }
    const sellerIntegration = await SellerIntegration.findOne({
      sellerId,
      integrationId: integration._id,
      isActive: true,
    });
    if (!sellerIntegration) {
      throw new SellerError('INTEGRATION_NOT_CONNECTED', `${integration.providerName} integration not connected`);
    }
    return { integration, sellerIntegration };
  }
}

export default new AnalyticsService();
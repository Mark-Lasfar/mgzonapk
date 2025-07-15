import { IIntegration } from '@/lib/db/models/integration.model';
import { ISellerIntegration } from '@/lib/db/models/seller-integration.model';
import { customLogger } from '@/lib/api/services/logging';
import axios from 'axios';
import { randomUUID } from 'crypto';
import { decrypt, encrypt } from '@/lib/utils/encryption';
import { NotificationService } from './notification';
import { get } from 'lodash';
import { SellerError } from '@/lib/errors/seller-error';

export interface ApiCallOptions {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  params?: Record<string, any>;
  body?: Record<string, any>;
  headers?: Record<string, string>;
  webhookEvent?: string;
  retryCount?: number;
}

export interface ProductData {
  sku: string;
  name: string;
  quantity: number;
  location?: string;
  [key: string]: any;
}

export class GenericIntegrationService {
  private integration: IIntegration;
  private sellerIntegration: ISellerIntegration;
  private requestId: string;
  private notificationService: NotificationService;
  private maxRetries: number;
  private retryDelay: number;

  constructor(integration: IIntegration, sellerIntegration: ISellerIntegration) {
    this.integration = integration;
    this.sellerIntegration = sellerIntegration;
    this.requestId = randomUUID();
    this.notificationService = new NotificationService();
    this.maxRetries = this.integration.settings?.retryOptions?.maxRetries || 3;
    this.retryDelay = this.integration.settings?.retryOptions?.initialDelay || 1000;
  }

  async callApi(options: ApiCallOptions): Promise<any> {
    const { endpoint, method, params, body, headers, webhookEvent, retryCount = 0 } = options;
    try {
      const baseUrl = this.integration.settings?.apiUrl;
      if (!baseUrl && !endpoint.startsWith('https://')) {
        throw new SellerError('CONFIG_ERROR', `Base URL not configured for ${this.integration.providerName} (${this.integration.type})`);
      }

      const url = endpoint.startsWith('https://') ? endpoint : `${baseUrl}${endpoint}`;
      const authHeaders: Record<string, string> = {};

      if (this.sellerIntegration.accessToken && this.integration.settings?.authType === 'OAuth') {
        authHeaders['Authorization'] = `Bearer ${decrypt(this.sellerIntegration.accessToken)}`;
      } else if (this.integration.settings?.authType === 'APIKey') {
        const apiKey = this.integration.credentials?.get('apiKey');
        if (!apiKey) {
          throw new SellerError('CONFIG_ERROR', `API Key not configured for ${this.integration.providerName}`);
        }
        authHeaders['X-API-Key'] = decrypt(apiKey);
      } else if (this.integration.settings?.authType === 'Basic') {
        const clientId = this.integration.credentials?.get('clientId');
        const clientSecret = this.integration.credentials?.get('clientSecret');
        if (!clientId || !clientSecret) {
          throw new SellerError('CONFIG_ERROR', `Client ID or Client Secret not configured for ${this.integration.providerName}`);
        }
        authHeaders['Authorization'] = `Basic ${Buffer.from(`${clientId}:${decrypt(clientSecret)}`).toString('base64')}`;
      }

      const config = {
        method,
        url,
        params,
        data: body,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': this.requestId,
          ...authHeaders,
          ...headers,
        },
      };

      if (this.sellerIntegration.expiresAt && this.sellerIntegration.expiresAt < new Date()) {
        await this.refreshToken();
      }

      const response = await axios(config);
      const mappedResponse = this.mapResponse(response.data);
      await customLogger.info('API call successful', {
        requestId: this.requestId,
        provider: this.integration.providerName,
        type: this.integration.type,
        endpoint,
        method,
        status: response.status,
        responseTime: response.headers['x-response-time'],
        service: 'generic-integration',
      });

      if (webhookEvent && this.sellerIntegration.webhook?.enabled && this.sellerIntegration.webhook?.url) {
        await this.notificationService.sendWebhook(
          {
            url: this.sellerIntegration.webhook.url,
            headers: { 'X-Webhook-Secret': decrypt(this.sellerIntegration.webhook.secret || '') },
          },
          {
            event: webhookEvent,
            provider: this.integration.providerName,
            data: mappedResponse,
            timestamp: new Date().toISOString(),
            requestId: this.requestId,
          }
        );
      }

      return mappedResponse;
    } catch (error) {
      const errorMessage = axios.isAxiosError(error) ? error.response?.data?.message || error.message : String(error);
      await customLogger.error('API call failed', {
        requestId: this.requestId,
        provider: this.integration.providerName,
        type: this.integration.type,
        endpoint,
        method,
        error: errorMessage,
        retryCount,
        service: 'generic-integration',
      });

      if (retryCount < this.maxRetries && this.shouldRetry(error)) {
        await new Promise((resolve) => setTimeout(resolve, this.retryDelay * Math.pow(2, retryCount)));
        return this.callApi({ ...options, retryCount: retryCount + 1 });
      }

      if (this.integration.type === 'payment') {
        const adminEmail = process.env.ADMIN_EMAIL;
        if (!adminEmail) {
          throw new SellerError('CONFIG_ERROR', 'Admin email not configured');
        }
        await this.notificationService.sendEmail(
          [adminEmail],
          `Critical Integration Failure: ${this.integration.providerName}`,
          {
            provider: this.integration.providerName,
            type: this.integration.type,
            error: errorMessage,
            requestId: this.requestId,
          }
        );
      }

      throw new SellerError('API_CALL_FAILED', `API call failed for ${this.integration.providerName}: ${errorMessage}`);
    }
  }

  async createProduct(productData: ProductData): Promise<{ id: string; [key: string]: any }> {
const endpoint = this.integration.apiEndpoints?.get('products') || '/products';
    try {
      const response = await this.callApi({
        endpoint,
        method: 'POST',
        body: productData,
        webhookEvent: 'product created',
      });

      if (!response.id) {
        throw new SellerError('INVALID_RESPONSE', 'No product ID returned from integration');
      }

      return {
        id: response.id,
        ...response,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await customLogger.error('Failed to create product', {
        requestId: this.requestId,
        provider: this.integration.providerName,
        type: this.integration.type,
        error: errorMessage,
        service: 'generic-integration',
      });
      throw new SellerError('PRODUCT_CREATION_FAILED', `Failed to create product for ${this.integration.providerName}: ${errorMessage}`);
    }
  }

  private mapResponse(data: any): any {
    const mapping = this.integration.settings?.responseMapping || new Map();
    if (mapping.size === 0) return data;

    const mappedData: Record<string, any> = {};
    for (const [key, path] of mapping.entries()) {
      mappedData[key] = get(data, path, null);
    }
    return mappedData;
  }

  private shouldRetry(error: any): boolean {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      return status === 429 || (status >= 500 && status < 600);
    }
    return false;
  }

  private async refreshToken(): Promise<void> {
    const requestId = randomUUID();
    try {
      if (!this.sellerIntegration.refreshToken) {
        throw new SellerError('NO_REFRESH_TOKEN', 'No refresh token available');
      }

      const tokenUrl = this.integration.oauth?.tokenUrl;
      if (!tokenUrl) {
        throw new SellerError('CONFIG_ERROR', 'Token URL not configured');
      }

      const response = await axios.post(
        tokenUrl,
        {
          grant_type: 'refresh_token',
          refresh_token: decrypt(this.sellerIntegration.refreshToken),
          client_id: this.integration.credentials?.get('clientId'),
          client_secret: decrypt(this.integration.credentials?.get('clientSecret') || ''),
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Request-ID': this.requestId,
          },
        }
      );

      const { access_token, refresh_token, expires_in } = response.data;
      this.sellerIntegration.accessToken = encrypt(access_token);
      if (refresh_token) {
        this.sellerIntegration.refreshToken = encrypt(refresh_token);
      }
      this.sellerIntegration.expiresAt = expires_in ? new Date(Date.now() + expires_in * 1000) : undefined;
      this.sellerIntegration.status = 'connected';
      await this.sellerIntegration.save();

      await customLogger.info('Token refreshed successfully', {
        requestId,
        provider: this.integration.providerName,
        type: this.integration.type,
        service: 'generic-integration',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.sellerIntegration.status = 'needs_reauth';
      await this.sellerIntegration.save();
      await customLogger.error('Failed to refresh token', {
        requestId,
        provider: this.integration.providerName,
        type: this.integration.type,
        error: errorMessage,
        service: 'generic-integration',
      });
      throw new SellerError('TOKEN_REFRESH_FAILED', `Token refresh failed for ${this.integration.providerName}: ${errorMessage}`);
    }
  }
}
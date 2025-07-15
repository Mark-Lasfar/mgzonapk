import { customLogger } from '@/lib/api/services/logging';
import { randomUUID } from 'crypto';
import { GenericIntegrationService, ApiCallOptions } from './generic-integration';
import { connectToDatabase } from '@/lib/db';
import IntegrationModel from '@/lib/db/models/integration.model';
import SellerIntegrationModel from '@/lib/db/models/seller-integration.model';
import Seller from '@/lib/db/models/seller.model';
import { SellerError } from '@/lib/errors/seller-error';
import { Types, Document } from 'mongoose';

interface Integration {
  _id: Types.ObjectId;
  providerName: string;
  type: string;
  isActive: boolean;
  status: 'connected' | 'disconnected' | 'expired' | 'needs_reauth';
  settings: {
    endpoints?: Map<string, string>;
    credentials?: {
      apiKey?: string;
      oauthToken?: string;
      refreshToken?: string;
      expiresAt?: Date;
    };
  };
}

interface SellerIntegration {
  _id: Types.ObjectId;
  sellerId: string;
  integrationId: string;
  isActive: boolean;
  status: 'connected' | 'disconnected' | 'expired' | 'needs_reauth';
}

export interface PaymentRequest {
  amount: number;
  currency: string;
  orderId: string;
  customer: {
    email: string;
    name: string;
    phone?: string;
  };
  metadata?: Record<string, any>;
}

export interface PaymentResponse {
  transactionId: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  paymentUrl?: string;
  metadata?: Record<string, any>;
}

export class PaymentService {
  private integration: Integration;
  private sellerIntegration: SellerIntegration;
  private requestId: string;
  private baseUrl: string;

  constructor(integration: Integration, sellerIntegration: SellerIntegration) {
    this.requestId = randomUUID();
    if (!integration.isActive || integration.status !== 'connected') {
      throw new SellerError('INACTIVE_INTEGRATION', `Integration ${integration.providerName} is not active or connected`);
    }
    this.integration = integration;
    this.sellerIntegration = sellerIntegration;
    this.baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';
    if (!this.baseUrl) {
      throw new SellerError('CONFIG_ERROR', 'Base URL is not configured');
    }
  }

  static async createFromSellerId(sellerId: string, providerName: string): Promise<PaymentService> {
    const requestId = randomUUID();
    try {
      await connectToDatabase();
      const integration = await IntegrationModel.findOne({
        providerName,
        type: 'payment',
        isActive: true,
        status: 'connected',
      });

      if (!integration) {
        throw new SellerError('NO_INTEGRATION', `No active payment integration found for provider ${providerName}`);
      }

      const sellerIntegration = await SellerIntegrationModel.findOne({
        sellerId,
        integrationId: integration._id,
        isActive: true,
        status: 'connected',
      });

      if (!sellerIntegration && providerName !== 'mgpay') {
        throw new SellerError('SELLER_NOT_ENABLED', `Seller ${sellerId} has not enabled ${providerName}`);
      }

      // التحقق من تفعيل الحساب البنكي لبوابة mgpay
      if (providerName === 'mgpay') {
        const seller = await Seller.findById(sellerId);
        if (!seller) {
          throw new SellerError('SELLER_NOT_FOUND', `Seller ${sellerId} not found`);
        }
        if (!seller.bankInfo?.verified) {
          throw new SellerError('BANK_NOT_VERIFIED', 'Bank account not verified');
        }
      }

      return new PaymentService(integration, sellerIntegration || { _id: new Types.ObjectId(), sellerId, integrationId: integration._id, isActive: true, status: 'connected' });
    } catch (error) {
      const errorMessage = error instanceof SellerError ? error.message : String(error);
      await customLogger.error('Failed to create PaymentService', {
        requestId,
        sellerId,
        providerName,
        error: errorMessage,
        service: 'payment',
      });
      throw error instanceof SellerError ? error : new SellerError('CREATE_FAILED', errorMessage);
    }
  }

  async initiatePayment(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      if (!this.integration.settings?.endpoints) {
        throw new SellerError('CONFIG_ERROR', `Endpoints not configured for ${this.integration.providerName}`);
      }

      const paymentEndpoint = this.integration.settings.endpoints.get('payment');
      if (!paymentEndpoint) {
        throw new SellerError('ENDPOINT_MISSING', `Payment endpoint not configured for ${this.integration.providerName}`);
      }

      

      const integrationService = new GenericIntegrationService(this.integration, this.sellerIntegration);
      const apiOptions: ApiCallOptions = {
        endpoint: paymentEndpoint,
        method: 'POST',
        headers: {
          ...(this.integration.settings.credentials?.apiKey && {
            Authorization: `Bearer ${this.integration.settings.credentials.apiKey}`,
          }),
        },
        body: {
          amount: request.amount,
          currency: request.currency,
          order_id: request.orderId,
          customer: request.customer,
          metadata: {
            ...request.metadata,
            success_url: `${this.baseUrl}/account/subscriptions?success=true`,
            cancel_url: `${this.baseUrl}/account/subscriptions?cancelled=true`,
            sellerId: this.sellerIntegration.sellerId,
          },
        },
        webhookEvent: 'payment.initiated',
      };

      const response = await integrationService.callApi(apiOptions);
      const result: PaymentResponse = {
        transactionId: response.transaction_id || response.id || randomUUID(),
        status: response.status || 'pending',
        paymentUrl: response.payment_url || response.redirect_url,
        metadata: response.metadata,
      };

      await customLogger.info('Payment initiated successfully', {
        requestId: this.requestId,
        provider: this.integration.providerName,
        transactionId: result.transactionId,
        status: result.status,
        sellerId: this.sellerIntegration.sellerId,
        service: 'payment',
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await customLogger.error('Payment initiation failed', {
        requestId: this.requestId,
        provider: this.integration.providerName,
        error: errorMessage,
        sellerId: this.sellerIntegration.sellerId,
        service: 'payment',
      });
      throw new SellerError('PAYMENT_FAILED', `Payment initiation failed: ${errorMessage}`);
    }
  }

  async verifyPayment(transactionId: string): Promise<PaymentResponse> {
    try {
      if (!this.integration.settings?.endpoints) {
        throw new SellerError('CONFIG_ERROR', `Endpoints not configured for ${this.integration.providerName}`);
      }

      const paymentEndpoint = this.integration.settings.endpoints.get('payment');
      if (!paymentEndpoint) {
        throw new SellerError('ENDPOINT_MISSING', `Payment endpoint not configured for ${this.integration.providerName}`);
      }

      const integrationService = new GenericIntegrationService(this.integration, this.sellerIntegration);
      const apiOptions: ApiCallOptions = {
        endpoint: `${paymentEndpoint}/${transactionId}`,
        method: 'GET',
        headers: {
          ...(this.integration.settings.credentials?.apiKey && {
            Authorization: `Bearer ${this.integration.settings.credentials.apiKey}`,
          }),
        },
        webhookEvent: 'payment.verified',
      };

      const response = await integrationService.callApi(apiOptions);
      const result: PaymentResponse = {
        transactionId: response.transaction_id || response.id,
        status: response.status || 'pending',
        metadata: response.metadata,
      };

      await customLogger.info('Payment verified successfully', {
        requestId: this.requestId,
        provider: this.integration.providerName,
        transactionId,
        status: result.status,
        sellerId: this.sellerIntegration.sellerId,
        service: 'payment',
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await customLogger.error('Payment verification failed', {
        requestId: this.requestId,
        provider: this.integration.providerName,
        transactionId,
        error: errorMessage,
        sellerId: this.sellerIntegration.sellerId,
        service: 'payment',
      });
      throw new SellerError('PAYMENT_VERIFICATION_FAILED', `Payment verification failed: ${errorMessage}`);
    }
  }

  async refreshOAuthToken(): Promise<void> {
    try {
      if (!this.integration.settings?.credentials?.refreshToken) {
        throw new SellerError('NO_REFRESH_TOKEN', `No refresh token available for ${this.integration.providerName}`);
      }

      const tokenEndpoint = this.integration.settings.endpoints?.get('token');
      if (!tokenEndpoint) {
        throw new SellerError('ENDPOINT_MISSING', `Token endpoint not configured for ${this.integration.providerName}`);
      }

      const integrationService = new GenericIntegrationService(this.integration, this.sellerIntegration);
      const response = await integrationService.callApi({
        endpoint: tokenEndpoint,
        method: 'POST',
        body: {
          grant_type: 'refresh_token',
          refresh_token: this.integration.settings.credentials.refreshToken,
        },
        webhookEvent: 'token.refreshed',
      });

      await IntegrationModel.updateOne(
        { _id: this.integration._id },
        {
          $set: {
            'settings.credentials.oauthToken': response.access_token,
            'settings.credentials.refreshToken': response.refresh_token || this.integration.settings.credentials.refreshToken,
            'settings.credentials.expiresAt': new Date(Date.now() + (response.expires_in * 1000)),
          },
        }
      );

      await customLogger.info('OAuth token refreshed successfully', {
        requestId: this.requestId,
        provider: this.integration.providerName,
        sellerId: this.sellerIntegration.sellerId,
        service: 'payment',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await customLogger.error('OAuth token refresh failed', {
        requestId: this.requestId,
        provider: this.integration.providerName,
        error: errorMessage,
        sellerId: this.sellerIntegration.sellerId,
        service: 'payment',
      });
      throw new SellerError('TOKEN_REFRESH_FAILED', `OAuth token refresh failed: ${errorMessage}`);
    }
  }
}
// /lib/api/services/payment.ts
'use server';

import { customLogger } from '@/lib/api/services/logging';
import { randomUUID } from 'crypto';
import { GenericIntegrationService, ApiCallOptions } from './generic-integration';
import { connectToDatabase } from '@/lib/db';
import Integration from '@/lib/db/models/integration.model';
import SellerIntegration from '@/lib/db/models/seller-integration.model';
import Seller from '@/lib/db/models/seller.model';
import { SellerError } from '@/lib/errors/seller-error';
import { Types } from 'mongoose';

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

export async function createPaymentService(sellerId: string, providerName: string): Promise<{
  integration: any | null;
  sellerIntegration: any | null;
  baseUrl: string;
  requestId: string;
}> {
  const requestId = randomUUID();
  try {
    await connectToDatabase();

    // Check if seller exists
    const seller = await Seller.findById(sellerId);
    if (!seller) {
      throw new SellerError('SELLER_NOT_FOUND', `Seller ${sellerId} not found`);
    }

    // If no providerName is specified, allow operation to proceed without payment gateway
    if (!providerName) {
      throw new SellerError('NO_PAYMENT_GATEWAY', 'No payment gateway specified. Please configure a payment gateway.');
    }

    // Check for integration (for non-mgpay providers)
    let integration: any | null = null;
    if (providerName !== 'mgpay') {
      integration = await Integration.findOne({
        providerName,
        type: 'payment',
        isActive: true,
        status: 'connected',
      });

      if (!integration) {
        throw new SellerError('NO_INTEGRATION', `No active payment integration found for provider ${providerName}`);
      }
    }

    // Check for seller integration (for non-mgpay providers)
    let sellerIntegration: any | null = null;
    if (providerName !== 'mgpay') {
      sellerIntegration = await SellerIntegration.findOne({
        sellerId: new Types.ObjectId(sellerId),
        integrationId: integration?._id,
        isActive: true,
        status: 'connected',
      });

      if (!sellerIntegration) {
        throw new SellerError('SELLER_NOT_ENABLED', `Seller ${sellerId} has not enabled ${providerName}`);
      }
    }

    // Verify bank account for mgpay
    if (providerName === 'mgpay') {
      const hasMgpay = seller.paymentGateways.some(
        (gateway: any) => gateway.providerName === 'mgpay' && gateway.isActive && gateway.verified
      );
      if (!hasMgpay || !seller.bankInfo?.verified) {
        throw new SellerError('BANK_NOT_VERIFIED', 'Bank account not verified or mgpay not active');
      }
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || '';
    if (!baseUrl) {
      throw new SellerError('CONFIG_ERROR', 'Base URL is not configured');
    }

    return {
      integration: integration || { _id: new Types.ObjectId(), providerName: 'mgpay', type: 'payment', isActive: true, status: 'connected', settings: {} },
      sellerIntegration: sellerIntegration || { _id: new Types.ObjectId(), sellerId, integrationId: integration?._id || new Types.ObjectId(), isActive: true, status: 'connected' },
      baseUrl,
      requestId,
    };
  } catch (error) {
    const errorMessage = error instanceof SellerError ? error.message : String(error);
    await customLogger.error('Failed to create PaymentService configuration', {
      requestId,
      sellerId,
      providerName,
      error: errorMessage,
      service: 'payment',
    });
    throw error instanceof SellerError ? error : new SellerError('CREATE_FAILED', errorMessage);
  }
}

export async function initiatePayment(sellerId: string, providerName: string, request: PaymentRequest): Promise<PaymentResponse> {
  const { integration, sellerIntegration, baseUrl, requestId } = await createPaymentService(sellerId, providerName);

  try {
    let paymentEndpoint = '';
    if (providerName !== 'mgpay') {
      paymentEndpoint = integration?.settings?.endpoints?.get('capturePayment') || '';
      if (!paymentEndpoint) {
        throw new SellerError('ENDPOINT_MISSING', `Payment endpoint not configured for ${integration.providerName}`);
      }
    }

    const integrationService = new GenericIntegrationService(integration, sellerIntegration);
    const apiOptions: ApiCallOptions = {
      endpoint: paymentEndpoint,
      method: 'POST',
      headers: {},
      body: {
        amount: request.amount,
        currency: request.currency,
        order_id: request.orderId,
        customer: request.customer,
        metadata: {
          ...request.metadata,
          success_url: `${baseUrl}/account/subscriptions?success=true`,
          cancel_url: `${baseUrl}/account/subscriptions?cancelled=true`,
          sellerId: sellerIntegration.sellerId,
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
      requestId,
      provider: integration?.providerName || 'mgpay',
      transactionId: result.transactionId,
      status: result.status,
      sellerId: sellerIntegration.sellerId,
      service: 'payment',
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await customLogger.error('Payment initiation failed', {
      requestId,
      provider: integration?.providerName || 'mgpay',
      error: errorMessage,
      sellerId: sellerIntegration.sellerId,
      service: 'payment',
    });
    throw new SellerError('PAYMENT_FAILED', `Payment initiation failed: ${errorMessage}`);
  }
}

export async function verifyPayment(sellerId: string, providerName: string, transactionId: string): Promise<PaymentResponse> {
  const { integration, sellerIntegration, requestId } = await createPaymentService(sellerId, providerName);

  try {
    let paymentEndpoint = '';
    if (providerName !== 'mgpay') {
      paymentEndpoint = integration?.settings?.endpoints?.get('capturePayment') || '';
      if (!paymentEndpoint) {
        throw new SellerError('ENDPOINT_MISSING', `Payment endpoint not configured for ${integration.providerName}`);
      }
    }

    const integrationService = new GenericIntegrationService(integration, sellerIntegration);
    const apiOptions: ApiCallOptions = {
      endpoint: `${paymentEndpoint}/${transactionId}`,
      method: 'GET',
      headers: {},
      webhookEvent: 'payment.verified',
    };

    const response = await integrationService.callApi(apiOptions);
    const result: PaymentResponse = {
      transactionId: response.transaction_id || response.id,
      status: response.status || 'pending',
      metadata: response.metadata,
    };

    await customLogger.info('Payment verified successfully', {
      requestId,
      provider: integration?.providerName || 'mgpay',
      transactionId,
      status: result.status,
      sellerId: sellerIntegration.sellerId,
      service: 'payment',
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await customLogger.error('Payment verification failed', {
      requestId,
      provider: integration?.providerName || 'mgpay',
      transactionId,
      error: errorMessage,
      sellerId: sellerIntegration.sellerId,
      service: 'payment',
    });
    throw new SellerError('PAYMENT_VERIFICATION_FAILED', `Payment verification failed: ${errorMessage}`);
  }
}

export async function refreshOAuthToken(sellerId: string, providerName: string): Promise<void> {
  const { integration, sellerIntegration, requestId } = await createPaymentService(sellerId, providerName);

  try {
    if (!sellerIntegration?.refreshToken && providerName !== 'mgpay') {
      throw new SellerError('NO_REFRESH_TOKEN', `No refresh token available for ${integration.providerName}`);
    }

    const tokenEndpoint = integration?.oauth?.tokenUrl || '';
    if (!tokenEndpoint && providerName !== 'mgpay') {
      throw new SellerError('ENDPOINT_MISSING', `Token endpoint not configured for ${integration.providerName}`);
    }

    const integrationService = new GenericIntegrationService(integration, sellerIntegration);
    const response = await integrationService.callApi({
      endpoint: tokenEndpoint,
      method: 'POST',
      body: {
        grant_type: 'refresh_token',
        refresh_token: sellerIntegration?.refreshToken,
        client_id: integration?.credentials?.get('clientId'),
        client_secret: integration?.credentials?.get('clientSecret'),
      },
      webhookEvent: 'token.refreshed',
    });

    await SellerIntegration.updateOne(
      { _id: sellerIntegration._id },
      {
        $set: {
          accessToken: response.access_token,
          refreshToken: response.refresh_token || sellerIntegration.refreshToken,
          expiresAt: new Date(Date.now() + (response.expires_in * 1000)),
          status: 'connected',
          lastUpdated: new Date(),
        },
      }
    );

    await customLogger.info('OAuth token refreshed successfully', {
      requestId,
      provider: integration?.providerName || 'mgpay',
      sellerId: sellerIntegration.sellerId,
      service: 'payment',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await customLogger.error('OAuth token refresh failed', {
      requestId,
      provider: integration?.providerName || 'mgpay',
      error: errorMessage,
      sellerId: sellerIntegration.sellerId,
      service: 'payment',
    });
    throw new SellerError('TOKEN_REFRESH_FAILED', `OAuth token refresh failed: ${errorMessage}`);
  }
}
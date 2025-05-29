import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { logger } from '@/lib/api/services/logging';
import { UnifiedFulfillmentService } from '@/lib/api/services/unified-fulfillment';
import { WebhookDispatcher } from '@/lib/api/webhook-dispatcher';

function verifySignature(request: NextRequest, provider: string): boolean {
  const signature = request.headers.get(`x-${provider}-signature`);
  const body = request.body;
  const secret = process.env[`${provider.toUpperCase()}_WEBHOOK_SECRET`];

  if (!signature || !secret) return false;

  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(JSON.stringify(body)).digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  );
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomBytes(16).toString('hex');
  const provider = request.headers.get('x-fulfillment-provider');

  try {
    // Verify webhook signature
    if (!provider || !verifySignature(request, provider)) {
      logger.warn('Invalid webhook signature', { requestId, provider });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = await request.json();

    logger.info('Received webhook', {
      requestId,
      provider,
      eventType: payload.eventType,
      orderId: payload.orderId
    });

    // Process the webhook based on provider
    const fulfillmentService = new UnifiedFulfillmentService([
      // ... provider configurations
    ]);

    // Update order status
    const result = await fulfillmentService.handleProviderWebhook(
      provider,
      payload
    );

    // Notify client via websocket
    await WebhookDispatcher.dispatch(
      payload.userId,
      `${provider}.order.updated`,
      result
    );

    return NextResponse.json({
      success: true,
      requestId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Webhook processing error', {
      requestId,
      provider,
      error: error.message,
      stack: error.stack
    });

    return NextResponse.json({
      success: false,
      error: 'Webhook processing failed',
      requestId,
      timestamp: new Date().toISOString()
    }, { 
      status: 500 
    });
  }
}
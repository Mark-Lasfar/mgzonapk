import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { logger } from '@/lib/api/services/logging';
import { UnifiedFulfillmentService } from '@/lib/api/services/unified-fulfillment';
import { WebhookDispatcher } from '@/lib/api/webhook-dispatcher';
import { z } from 'zod';

// تعريف Schema للتحقق من البيانات
const WebhookPayloadSchema = z.object({
  eventType: z.string().min(1, 'Event type is required'),
  orderId: z.string().min(1, 'Order ID is required'),
  userId: z.string().min(1, 'User ID is required'),
});

function verifySignature(request: NextRequest, provider: string, body: string): boolean {
  const signature = request.headers.get(`x-${provider}-signature`);
  const secret = process.env[`${provider.toUpperCase()}_WEBHOOK_SECRET`];

  if (!signature || !secret) {
    logger.warn('Missing signature or secret', { provider });
    return false;
  }

  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(body).digest('hex');

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomBytes(16).toString('hex');
  const provider = request.headers.get('x-fulfillment-provider');

  try {
    // التحقق من الـ provider
    if (!provider || !['shipbob', 'amazon'].includes(provider)) {
      logger.warn('Invalid or missing provider', { requestId, provider });
      return NextResponse.json({
        success: false,
        error: 'Invalid or missing provider',
        requestId,
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }

    // التحقق من المتغيرات البيئية
    const requiredEnvVars = provider === 'shipbob'
      ? ['SHIPBOB_API_KEY', 'SHIPBOB_API_URL']
      : ['AMAZON_REGION', 'AMAZON_REFRESH_TOKEN', 'AMAZON_CLIENT_ID', 'AMAZON_CLIENT_SECRET', 'AMAZON_AWS_ACCESS_KEY', 'AMAZON_AWS_SECRET_KEY', 'AMAZON_ROLE_ARN'];

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        logger.error(`Missing environment variable: ${envVar}`, { requestId });
        return NextResponse.json({
          success: false,
          error: `Server configuration error: Missing ${envVar}`,
          requestId,
          timestamp: new Date().toISOString(),
        }, { status: 500 });
      }
    }

    // قراءة الـ body
    const bodyText = await request.text();
    const payload = JSON.parse(bodyText);

    // التحقق من التوقيع
    if (!verifySignature(request, provider, bodyText)) {
      logger.warn('Invalid webhook signature', { requestId, provider });
      return NextResponse.json({
        success: false,
        error: 'Invalid signature',
        requestId,
        timestamp: new Date().toISOString(),
      }, { status: 401 });
    }

    // التحقق من البيانات
    const parsed = WebhookPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      logger.warn('Invalid webhook payload', { requestId, provider, errors: parsed.error.errors });
      return NextResponse.json({
        success: false,
        error: 'Invalid webhook payload',
        details: parsed.error.errors,
        requestId,
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }

    logger.info('Received webhook', {
      requestId,
      provider,
      eventType: payload.eventType,
      orderId: payload.orderId,
    });

    // معالجة الـ webhook
    const fulfillmentService = new UnifiedFulfillmentService({
      apiKey: process.env[`${provider.toUpperCase()}_API_KEY`] || '',
      region: process.env.AMAZON_REGION || 'na',
      credentials: {
        refreshToken: process.env.AMAZON_REFRESH_TOKEN || '',
        clientId: process.env.AMAZON_CLIENT_ID || '',
        clientSecret: process.env.AMAZON_CLIENT_SECRET || '',
        awsAccessKey: process.env.AMAZON_AWS_ACCESS_KEY || '',
        awsSecretKey: process.env.AMAZON_AWS_SECRET_KEY || '',
        roleArn: process.env.AMAZON_ROLE_ARN || '',
      },
    });

    const result = await fulfillmentService.handleWebhook(provider, payload);

    // إرسال الـ webhook عبر WebhookDispatcher
    await WebhookDispatcher.dispatch(payload.userId, `${provider}.order.updated`, result);

    return NextResponse.json({
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Webhook processing error', {
      requestId,
      provider,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json({
      success: false,
      error: 'Webhook processing failed',
      requestId,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/api/middleware/auth';
import { connectToDatabase } from '@/lib/db';
import Product from '@/lib/db/models/product.model';
import Order from '@/lib/db/models/order.model';
import WebhookModel from '@/lib/db/models/webhook.model';
import { logger } from '@/lib/api/services/logging';
import crypto from 'crypto';

function verifySignature(request: NextRequest, provider: string, body: any): boolean {
  const signature = request.headers.get(`x-${provider}-signature`);
  const secret = process.env[`${provider.toUpperCase()}_WEBHOOK_SECRET`];
  if (!signature || !secret) return false;

  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(JSON.stringify(body)).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

export async function POST(request: NextRequest) {
  const requestId = crypto.randomBytes(16).toString('hex');

  try {
    const authError = await validateApiKey(request);
    if (authError) return authError;

    await connectToDatabase();
    const payload = await request.json();
    const { provider, event, data } = payload;

    if (!['shipbob', '4px'].includes(provider)) {
      logger.warn('Invalid webhook provider', { requestId, provider });
      return NextResponse.json({
        success: false,
        error: 'Invalid provider',
        requestId,
      }, { status: 400 });
    }

    if (!verifySignature(request, provider, payload)) {
      logger.warn('Invalid webhook signature', { requestId, provider });
      return NextResponse.json({
        success: false,
        error: 'Invalid signature',
        requestId,
      }, { status: 401 });
    }

    logger.info('Processing webhook', { requestId, provider, event });

    switch (event) {
      case 'inventory_updated':
        await Product.updateOne(
          { 'warehouseData.sku': data.sku, 'warehouseData.provider': provider },
          {
            $set: {
              'warehouseData.$.quantity': data.quantity,
              'warehouseData.$.lastUpdated': new Date(),
            },
          }
        );
        break;

      case 'order_created':
        await Order.create({
          orderId: data.orderId,
          provider,
          status: data.status,
          items: data.items,
          shippingAddress: data.shippingAddress,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        break;

      case 'order_updated':
        await Order.updateOne(
          { orderId: data.orderId, provider },
          {
            $set: {
              status: data.status,
              updatedAt: new Date(),
            },
          }
        );
        break;

      default:
        logger.warn('Unsupported webhook event', { requestId, provider, event });
        return NextResponse.json({
          success: false,
          error: 'Unsupported event',
          requestId,
        }, { status: 400 });
    }

    await WebhookModel.create({
      userId: 'system',
      url: request.url,
      events: [event],
      secret: process.env[`${provider.toUpperCase()}_WEBHOOK_SECRET`],
      isActive: true,
      lastTriggered: new Date(),
    });

    return NextResponse.json({
      success: true,
      message: `Event ${event} processed successfully`,
      requestId,
    });
  } catch (error) {
    logger.error('Webhook processing error', {
      requestId,
      provider,
      error: error.message,
    });
    return NextResponse.json({
      success: false,
      error: error.message,
      requestId,
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    const webhooks = await WebhookModel.find({}).select('-secret');
    return NextResponse.json({
      success: true,
      data: webhooks,
    });
  } catch (error) {
    logger.error('Get webhooks failed', { error });
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
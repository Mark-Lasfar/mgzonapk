import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/api/middleware/auth';
import { rateLimit, RateLimitResponse } from '@/lib/api/middleware/rate-limit';
import { connectToDatabase } from '@/lib/db';
import { ShipBobService } from '@/lib/api/integrations/shipbob/service';
import { AmazonFBAService } from '@/lib/api/integrations/amazon/service';
import crypto from 'crypto';
import { logger } from '@/lib/api/services/logging';
import { z } from 'zod';

// تعريف Schema للتحقق من البيانات
const RequestSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  provider: z.enum(['shipbob', 'amazon']).optional().default('shipbob'),
  shippingMethod: z.string().optional(),
  items: z.array(
    z.object({
      sku: z.string().min(1, 'SKU is required'),
      quantity: z.number().min(1, 'Quantity must be at least 1'),
      productId: z.string().optional(),
    })
  ).min(1, 'At least one item is required'),
  shippingAddress: z.object({
    name: z.string().min(1, 'Name is required'),
    street: z.string().min(1, 'Street is required'),
    city: z.string().min(1, 'City is required'),
    state: z.string().optional(),
    country: z.string().min(2, 'Country is required'),
    postalCode: z.string().min(1, 'Postal code is required'),
    phone: z.string().optional(),
  }),
  options: z.record(z.any()).optional(),
});

// تعريف الـ runtime لتجنب تحذير Edge
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const requestId = crypto.randomBytes(16).toString('hex');

  try {
    // التحقق من API Key
    const authError = await validateApiKey(request);
    if (authError) return authError;

    // التحقق من Rate Limiting
    const rateLimitResult = await rateLimit(request);
    if (rateLimitResult instanceof NextResponse) return rateLimitResult;

    // الاتصال بالداتابيز
    await connectToDatabase();

    // التحقق من البيانات
    const body = await request.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request data',
        details: parsed.error.errors,
        requestId,
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }

    const { orderId, provider, shippingMethod, items, shippingAddress, options = {} } = parsed.data;

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

    let service;
    let result;
    switch (provider) {
      case 'shipbob':
        service = new ShipBobService({
          apiKey: process.env.SHIPBOB_API_KEY!,
          apiUrl: process.env.SHIPBOB_API_URL!,
        });
        result = await service.createShipment({
          orderId,
          items: items.map((item: { sku: string; quantity: number; productId?: string }) => ({
            sku: item.sku,
            quantity: item.quantity,
            productId: item.productId,
          })),
          shippingAddress,
          shippingMethod: shippingMethod || 'standard',
        });
        break;
      case 'amazon':
        service = new AmazonFBAService({
          region: process.env.AMAZON_REGION || 'na',
          refreshToken: process.env.AMAZON_REFRESH_TOKEN!,
          clientId: process.env.AMAZON_CLIENT_ID!,
          clientSecret: process.env.AMAZON_CLIENT_SECRET!,
          awsAccessKey: process.env.AMAZON_AWS_ACCESS_KEY!,
          awsSecretKey: process.env.AMAZON_AWS_SECRET_KEY!,
          roleArn: process.env.AMAZON_ROLE_ARN!,
        });
        result = await service.createFulfillmentOrder({
          orderId,
          items: items.map((item: { sku: string; quantity: number }) => ({
            sku: item.sku,
            quantity: item.quantity,
          })),
          shippingAddress,
          shippingMethod: shippingMethod || 'Standard',
        });
        break;
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid provider',
          requestId,
          timestamp: new Date().toISOString(),
        }, { status: 400 });
    }

    logger.info('Fulfillment created', { provider, orderId, requestId });

    return NextResponse.json({
      success: true,
      data: result,
      requestId,
      timestamp: new Date().toISOString(),
    }, {
      headers: {
        ...(rateLimitResult as RateLimitResponse)?.headers || {}, // التحقق من وجود headers
        'X-Request-ID': requestId,
        'X-Provider': provider,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Fulfillment error', {
      requestId,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json({
      success: false,
      error: errorMessage,
      requestId,
      timestamp: new Date().toISOString(),
    }, {
      status: 500,
      headers: { 'X-Request-ID': requestId },
    });
  }
}

export async function GET(request: NextRequest) {
  const requestId = crypto.randomBytes(16).toString('hex');

  try {
    const authError = await validateApiKey(request);
    if (authError) return authError;

    const rateLimitResult = await rateLimit(request);
    if (rateLimitResult instanceof NextResponse) return rateLimitResult;

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    const provider = searchParams.get('provider') || 'shipbob';

    if (!orderId) {
      return NextResponse.json({
        success: false,
        error: 'Order ID is required',
        requestId,
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }

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

    let service;
    let result;
    switch (provider) {
      case 'shipbob':
        service = new ShipBobService({
          apiKey: process.env.SHIPBOB_API_KEY!,
          apiUrl: process.env.SHIPBOB_API_URL!,
        });
        result = await service.getFulfillmentStatus(orderId);
        break;
      case 'amazon':
        service = new AmazonFBAService({
          region: process.env.AMAZON_REGION || 'na',
          refreshToken: process.env.AMAZON_REFRESH_TOKEN!,
          clientId: process.env.AMAZON_CLIENT_ID!,
          clientSecret: process.env.AMAZON_CLIENT_SECRET!,
          awsAccessKey: process.env.AMAZON_AWS_ACCESS_KEY!,
          awsSecretKey: process.env.AMAZON_AWS_SECRET_KEY!,
          roleArn: process.env.AMAZON_ROLE_ARN!,
        });
        result = await service.getFulfillmentOrder(orderId);
        break;
      default:
        return NextResponse.json({
          success: false,
          error: 'Invalid provider',
          requestId,
          timestamp: new Date().toISOString(),
        }, { status: 400 });
    }

    logger.info('Fulfillment status retrieved', { provider, orderId, requestId });

    return NextResponse.json({
      success: true,
      data: result,
      requestId,
      timestamp: new Date().toISOString(),
    }, {
      headers: {
        ...(rateLimitResult as RateLimitResponse)?.headers || {},
        'X-Request-ID': requestId,
        'X-Provider': provider,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Tracking error', {
      requestId,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json({
      success: false,
      error: errorMessage,
      requestId,
      timestamp: new Date().toISOString(),
    }, {
      status: 500,
      headers: { 'X-Request-ID': requestId },
    });
  }
}
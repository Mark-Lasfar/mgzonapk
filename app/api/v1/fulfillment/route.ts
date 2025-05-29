import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/api/middleware/auth';
import { rateLimit } from '@/lib/api/middleware/rate-limit';
import { connectToDatabase } from '@/lib/db';
import { ShipBobService } from '@/lib/api/integrations/warehouses/shipbob/service';
import { FourPXService } from '@/lib/api/integrations/warehouses/4px/service';
import { AmazonService } from '@/lib/api/integrations/marketplaces/amazon/service';
import { AliExpressService } from '@/lib/api/integrations/marketplaces/aliexpress/service';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  const requestId = crypto.randomBytes(16).toString('hex');

  try {
    const authError = await validateApiKey(request);
    if (authError) return authError;

    const rateLimitResult = await rateLimit(request);
    if (rateLimitResult instanceof NextResponse) return rateLimitResult;

    await connectToDatabase();
    const {
      orderId,
      provider,
      shippingMethod,
      items,
      shippingAddress,
      options = {},
    } = await request.json();

    if (!orderId || !items || !shippingAddress) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields',
        requestId,
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }

    let service;
    switch (provider) {
      case 'shipbob':
        service = new ShipBobService({
          apiKey: process.env.SHIPBOB_API_KEY!,
          apiUrl: process.env.SHIPBOB_API_URL!,
        });
        break;
      case '4px':
        service = new FourPXService({
          apiKey: process.env.FOURPX_API_KEY!,
          apiSecret: process.env.FOURPX_API_SECRET!,
          apiUrl: process.env.FOURPX_API_URL!,
        });
        break;
      case 'amazon':
        service = new AmazonService({
          accessToken: process.env.AMAZON_ACCESS_TOKEN!,
          refreshToken: process.env.AMAZON_REFRESH_TOKEN!,
          merchantId: process.env.AMAZON_MERCHANT_ID!,
          apiUrl: process.env.AMAZON_API_URL!,
        });
        break;
      case 'aliexpress':
        service = new AliExpressService({
          apiKey: process.env.ALIEXPRESS_API_KEY!,
          apiSecret: process.env.ALIEXPRESS_API_SECRET!,
          accessToken: process.env.ALIEXPRESS_ACCESS_TOKEN!,
          apiUrl: process.env.ALIEXPRESS_API_URL!,
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

    const result = await service.createOrder({
      orderId,
      items,
      shippingAddress,
      shippingMethod,
      platformId: 'MGZON_001',
      ...options,
    });

    return NextResponse.json({
      success: true,
      data: result,
      requestId,
      timestamp: new Date().toISOString(),
    }, {
      headers: {
        ...rateLimitResult?.headers,
        'X-Request-ID': requestId,
        'X-Provider': provider,
      },
    });
  } catch (error) {
    console.error(`[${requestId}] Fulfillment error:`, error);
    return NextResponse.json({
      success: false,
      error: error.message,
      requestId,
      timestamp: new Date().toISOString(),
    }, {
      status: error.status || 500,
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

    let service;
    switch (provider) {
      case 'shipbob':
        service = new ShipBobService({
          apiKey: process.env.SHIPBOB_API_KEY!,
          apiUrl: process.env.SHIPBOB_API_URL!,
        });
        break;
      case '4px':
        service = new FourPXService({
          apiKey: process.env.FOURPX_API_KEY!,
          apiSecret: process.env.FOURPX_API_SECRET!,
          apiUrl: process.env.FOURPX_API_URL!,
        });
        break;
      case 'amazon':
        service = new AmazonService({
          accessToken: process.env.AMAZON_ACCESS_TOKEN!,
          refreshToken: process.env.AMAZON_REFRESH_TOKEN!,
          merchantId: process.env.AMAZON_MERCHANT_ID!,
          apiUrl: process.env.AMAZON_API_URL!,
        });
        break;
      case 'aliexpress':
        service = new AliExpressService({
          apiKey: process.env.ALIEXPRESS_API_KEY!,
          apiSecret: process.env.ALIEXPRESS_API_SECRET!,
          accessToken: process.env.ALIEXPRESS_ACCESS_TOKEN!,
          apiUrl: process.env.ALIEXPRESS_API_URL!,
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

    const result = await service.getOrder(orderId);

    return NextResponse.json({
      success: true,
      data: result,
      requestId,
      timestamp: new Date().toISOString(),
    }, {
      headers: {
        ...rateLimitResult?.headers,
        'X-Request-ID': requestId,
        'X-Provider': provider,
      },
    });
  } catch (error) {
    console.error(`[${requestId}] Tracking error:`, error);
    return NextResponse.json({
      success: false,
      error: error.message,
      requestId,
      timestamp: new Date().toISOString(),
    }, {
      status: error.status || 500,
      headers: { 'X-Request-ID': requestId },
    });
  }
}
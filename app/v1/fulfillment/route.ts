import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/api/middleware/auth';
import { rateLimit } from '@/lib/api/middleware/rate-limit';
import { UnifiedFulfillmentService } from '@/lib/api/services/unified-fulfillment';
import { connectToDatabase } from '@/lib/db';
import { FulfillmentProvider } from '@/lib/api/types/fulfillment';
import crypto from 'crypto';

// Initialize the unified fulfillment service with all provider configurations
const fulfillmentService = new UnifiedFulfillmentService([
  {
    provider: 'shipbob',
    credentials: {
      apiKey: process.env.SHIPBOB_API_KEY!,
      apiUrl: process.env.SHIPBOB_API_URL!,
    }
  },
  {
    provider: 'amazon',
    credentials: {
      accessToken: process.env.AMAZON_ACCESS_TOKEN!,
      refreshToken: process.env.AMAZON_REFRESH_TOKEN!,
      merchantId: process.env.AMAZON_MERCHANT_ID!,
    }
  },
  {
    provider: 'aliexpress',
    credentials: {
      apiKey: process.env.ALIEXPRESS_API_KEY!,
      apiSecret: process.env.ALIEXPRESS_API_SECRET!,
      accessToken: process.env.ALIEXPRESS_ACCESS_TOKEN!,
    }
  },
  {
    provider: '4px',
    credentials: {
      apiKey: process.env.FOURPX_API_KEY!,
      apiSecret: process.env.FOURPX_API_SECRET!,
      warehouseId: process.env.FOURPX_WAREHOUSE_ID!,
    }
  }
]);

export async function POST(request: NextRequest) {
  // Generate request ID for tracking
  const requestId = crypto.randomBytes(16).toString('hex');

  try {
    // Validate API key
    const authError = await validateApiKey(request);
    if (authError) return authError;

    // Check rate limits
    const rateLimitResult = await rateLimit(request);
    if (rateLimitResult instanceof NextResponse) return rateLimitResult;

    // Connect to database
    await connectToDatabase();
    
    const { 
      orderId,
      provider = 'shipbob' as FulfillmentProvider,
      shippingMethod,
      items,
      shippingAddress,
      options = {}
    } = await request.json();

    // Validate required fields
    if (!orderId || !items || !shippingAddress) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields',
          requestId,
          timestamp: new Date().toISOString()
        },
        { status: 400 }
      );
    }

    const result = await fulfillmentService.createFulfillmentOrder({
      orderId,
      provider,
      items,
      shippingAddress,
      shippingMethod,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...options
    });

    return NextResponse.json({
      success: true,
      data: result,
      requestId,
      timestamp: new Date().toISOString()
    }, {
      headers: {
        ...rateLimitResult?.headers,
        'X-Request-ID': requestId,
        'X-Provider': provider
      }
    });

  } catch (error) {
    console.error(`[${requestId}] Fulfillment error:`, error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      requestId,
      timestamp: new Date().toISOString()
    }, { 
      status: error.status || 500,
      headers: {
        'X-Request-ID': requestId
      }
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
    const provider = searchParams.get('provider') as FulfillmentProvider || 'shipbob';

    if (!orderId) {
      return NextResponse.json({
        success: false,
        error: 'Order ID is required',
        requestId,
        timestamp: new Date().toISOString()
      }, { 
        status: 400 
      });
    }

    const result = await fulfillmentService.getFulfillmentOrder(orderId, provider);

    return NextResponse.json({
      success: true,
      data: result,
      requestId,
      timestamp: new Date().toISOString()
    }, {
      headers: {
        ...rateLimitResult?.headers,
        'X-Request-ID': requestId,
        'X-Provider': provider
      }
    });

  } catch (error) {
    console.error(`[${requestId}] Tracking error:`, error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      requestId,
      timestamp: new Date().toISOString()
    }, { 
      status: error.status || 500,
      headers: {
        'X-Request-ID': requestId
      }
    });
  }
}
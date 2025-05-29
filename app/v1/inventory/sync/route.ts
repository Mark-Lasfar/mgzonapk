import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/api/middleware/auth';
import { rateLimit } from '@/lib/api/middleware/rate-limit';
import { UnifiedFulfillmentService } from '@/lib/api/services/unified-fulfillment';
import { logger } from '@/lib/api/services/logging';
import { connectToDatabase } from '@/lib/db';
import crypto from 'crypto';

// Initialize the fulfillment service with all provider configurations
const fulfillmentService = new UnifiedFulfillmentService([
  {
    provider: 'shipbob',
    credentials: {
      apiKey: process.env.SHIPBOB_API_KEY!,
      apiUrl: process.env.SHIPBOB_API_URL!,
    }
  },
  {
    provider: 'shopify',
    credentials: {
      apiKey: process.env.MGZON_API_KEY!,
      apiSecret: process.env.MGZON_API_SECRET!,
      domain: process.env.SHOPIFY_DOMAIN!,
      accessToken: process.env.SHOPIFY_ACCESS_TOKEN!,
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
    }
  },
  {
    provider: '4px',
    credentials: {
      apiKey: process.env.FOURPX_API_KEY!,
      apiSecret: process.env.FOURPX_API_SECRET!,
      warehouseId: process.env.FOURPX_WAREHOUSE_ID,
    }
  }
]);

export async function POST(request: NextRequest) {
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
      providers,
      options = {}
    } = await request.json();

    // Validate providers
    if (!providers || !Array.isArray(providers)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Providers array is required',
          requestId,
          timestamp: new Date().toISOString()
        },
        { status: 400 }
      );
    }

    // Start inventory sync for each provider
    const syncs = await Promise.allSettled(
      providers.map(async (provider) => {
        try {
          const syncId = crypto.randomBytes(8).toString('hex');
          
          // Start async sync process
          const result = await fulfillmentService.syncInventory({
            provider,
            syncId,
            options: {
              ...options,
              requestId,
              fullSync: options.fullSync || false,
              forceUpdate: options.forceUpdate || false,
            }
          });

          return {
            provider,
            syncId,
            status: 'started',
            result
          };
        } catch (error) {
          logger.error('Provider sync failed', {
            provider,
            requestId,
            error: error.message
          });
          
          return {
            provider,
            status: 'failed',
            error: error.message
          };
        }
      })
    );

    // Process results
    const successfulSyncs = syncs
      .filter((result): result is PromiseFulfilledResult<any> => 
        result.status === 'fulfilled'
      )
      .map(result => result.value);

    const failedSyncs = syncs
      .filter((result): result is PromiseRejectedResult => 
        result.status === 'rejected'
      )
      .map(result => ({
        provider: result.reason.provider,
        error: result.reason.message
      }));

    // Return response with sync status
    return NextResponse.json({
      success: true,
      data: {
        requestId,
        timestamp: new Date().toISOString(),
        syncCount: successfulSyncs.length,
        failCount: failedSyncs.length,
        syncs: successfulSyncs,
        failures: failedSyncs
      }
    }, {
      headers: {
        ...rateLimitResult?.headers,
        'X-Request-ID': requestId
      }
    });

  } catch (error) {
    logger.error('Inventory sync failed', {
      requestId,
      error: error.message,
      stack: error.stack
    });

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        requestId,
        timestamp: new Date().toISOString()
      },
      { 
        status: 500,
        headers: {
          'X-Request-ID': requestId
        }
      }
    );
  }
}

export async function GET(request: NextRequest) {
  const requestId = crypto.randomBytes(16).toString('hex');

  try {
    // Validate API key
    const authError = await validateApiKey(request);
    if (authError) return authError;

    // Check rate limits
    const rateLimitResult = await rateLimit(request);
    if (rateLimitResult instanceof NextResponse) return rateLimitResult;

    const { searchParams } = new URL(request.url);
    const syncId = searchParams.get('syncId');
    const provider = searchParams.get('provider');

    if (!syncId || !provider) {
      return NextResponse.json(
        {
          success: false,
          error: 'Both syncId and provider are required',
          requestId,
          timestamp: new Date().toISOString()
        },
        { status: 400 }
      );
    }

    const status = await fulfillmentService.getSyncStatus(syncId, provider);

    return NextResponse.json({
      success: true,
      data: {
        ...status,
        requestId,
        timestamp: new Date().toISOString()
      }
    }, {
      headers: {
        ...rateLimitResult?.headers,
        'X-Request-ID': requestId
      }
    });

  } catch (error) {
    logger.error('Get sync status failed', {
      requestId,
      error: error.message
    });

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        requestId,
        timestamp: new Date().toISOString()
      },
      { 
        status: 500,
        headers: {
          'X-Request-ID': requestId
        }
      }
    );
  }
}
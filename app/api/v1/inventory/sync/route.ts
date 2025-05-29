import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/api/middleware/auth';
import { rateLimit } from '@/lib/api/middleware/rate-limit';
import { connectToDatabase } from '@/lib/db';
import { ShipBobService } from '@/lib/api/integrations/warehouses/shipbob/service';
import { FourPXService } from '@/lib/api/integrations/warehouses/4px/service';
import { AmazonService } from '@/lib/api/integrations/marketplaces/amazon/service';
import { AliExpressService } from '@/lib/api/integrations/marketplaces/aliexpress/service';
import { logger } from '@/lib/api/services/logging';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  const requestId = crypto.randomBytes(16).toString('hex');

  try {
    const authError = await validateApiKey(request);
    if (authError) return authError;

    const rateLimitResult = await rateLimit(request);
    if (rateLimitResult instanceof NextResponse) return rateLimitResult;

    await connectToDatabase();
    const { providers, options = {} } = await request.json();

    if (!providers || !Array.isArray(providers)) {
      return NextResponse.json({
        success: false,
        error: 'Providers array is required',
        requestId,
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }

    const syncs = await Promise.allSettled(
      providers.map(async (provider: string) => {
        try {
          const syncId = crypto.randomBytes(8).toString('hex');
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
              throw new Error(`Unsupported provider: ${provider}`);
          }

          const result = await service.getInventoryLevels(options.productIds);
          return { provider, syncId, status: 'started', result };
        } catch (error) {
          logger.error('Provider sync failed', {
            provider,
            requestId,
            error: error.message,
          });
          return { provider, status: 'failed', error: error.message };
        }
      })
    );

    const successfulSyncs = syncs
      .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
      .map(result => result.value);

    const failedSyncs = syncs
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map(result => ({
        provider: result.reason.provider,
        error: result.reason.message,
      }));

    return NextResponse.json({
      success: true,
      data: {
        requestId,
        timestamp: new Date().toISOString(),
        syncCount: successfulSyncs.length,
        failCount: failedSyncs.length,
        syncs: successfulSyncs,
        failures: failedSyncs,
      },
    }, {
      headers: {
        ...rateLimitResult?.headers,
        'X-Request-ID': requestId,
      },
    });
  } catch (error) {
    logger.error('Inventory sync failed', {
      requestId,
      error: error.message,
    });
    return NextResponse.json({
      success: false,
      error: error.message,
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
    const syncId = searchParams.get('syncId');
    const provider = searchParams.get('provider');

    if (!syncId || !provider) {
      return NextResponse.json({
        success: false,
        error: 'Both syncId and provider are required',
        requestId,
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }

    // Placeholder for sync status checking
    return NextResponse.json({
      success: true,
      data: {
        syncId,
        provider,
        status: 'pending',
        requestId,
        timestamp: new Date().toISOString(),
      },
    }, {
      headers: {
        ...rateLimitResult?.headers,
        'X-Request-ID': requestId,
      },
    });
  } catch (error) {
    logger.error('Get sync status failed', {
      requestId,
      error: error.message,
    });
    return NextResponse.json({
      success: false,
      error: error.message,
      requestId,
      timestamp: new Date().toISOString(),
    }, {
      status: 500,
      headers: { 'X-Request-ID': requestId },
    });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/api/middleware/auth';
import { rateLimit } from '@/lib/api/middleware/rate-limit';
import { shipbobAuthMiddleware } from '@/lib/api/middleware/auth/shipbob';
import { connectToDatabase } from '@/lib/db';
import { ShipBobService } from '@/lib/api/integrations/shipbob/service';
import { AmazonFBAService } from '@/lib/api/integrations/amazon/service';
import { logger } from '@/lib/api/services/logging';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  const requestId = crypto.randomBytes(16).toString('hex');

  try {
    // Apply API key validation
    const authError = await validateApiKey(request);
    if (authError) return authError;

    // Apply ShipBob auth middleware
    const shipbobAuthResult = await shipbobAuthMiddleware(request);
    if (shipbobAuthResult) return shipbobAuthResult;

    // Apply rate limiting
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

    const accessToken = (request as any).shipbobAccessToken;

    const syncs = await Promise.allSettled(
      providers.map(async (provider: string) => {
        try {
          const syncId = crypto.randomBytes(8).toString('hex');
          let service;

          switch (provider) {
            case 'shipbob':
              service = new ShipBobService({
                accessToken,
                apiUrl: process.env.SHIPBOB_API_URL || 'https://api.shipbob.com',
                channelId: process.env.SHIPBOB_CHANNEL_ID!,
              });
              break;
            case 'amazon':
              service = new AmazonFBAService({
                region: process.env.AMAZON_REGION || 'na',
                credentials: {
                  refreshToken: process.env.AMAZON_REFRESH_TOKEN!,
                  clientId: process.env.AMAZON_CLIENT_ID!,
                  clientSecret: process.env.AMAZON_CLIENT_SECRET!,
                  awsAccessKey: process.env.AMAZON_AWS_ACCESS_KEY!,
                  awsSecretKey: process.env.AMAZON_AWS_SECRET_KEY!,
                  roleArn: process.env.AMAZON_ROLE_ARN!,
                },
              });
              break;
            default:
              throw new Error(`Unsupported provider: ${provider}`);
          }

          const result = await service.getInventory(options.productIds);
          return {
            provider,
            syncId,
            status: 'completed',
            result: result.map((item: any) => ({
              sku: item.sku,
              quantity: item.quantity || item.availableQuantity || item.available || 0,
              available_quantity: item.available_quantity || item.availableQuantity || item.available || 0,
              reference_id: item.reference_id || item.asin,
            })),
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error('Provider sync failed', { provider, requestId, error: errorMessage });
          return { provider, syncId: crypto.randomBytes(8).toString('hex'), status: 'failed', error: errorMessage };
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
        syncId: result.reason.syncId,
        error: result.reason.error,
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
        ...(rateLimitResult?.headers || {}),
        'X-Request-ID': requestId,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Inventory sync failed', { requestId, error: errorMessage });
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

    // Placeholder: No sync tracking DB implemented
    return NextResponse.json({
      success: true,
      data: {
        syncId,
        provider,
        status: 'unknown',
        message: 'Sync status tracking not implemented',
        requestId,
        timestamp: new Date().toISOString(),
      },
    }, {
      headers: {
        ...(rateLimitResult?.headers || {}),
        'X-Request-ID': requestId,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Get sync status failed', { requestId, error: errorMessage });
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
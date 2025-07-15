import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Seller from '@/lib/db/models/seller.model';
import { logger } from '@/lib/api/services/logging';
// import { ShipBobService } from '@/lib/api/integrations/shipbob/service';
import crypto from 'crypto';
import { ShipBobService } from '../../integrations/shipbob/service';

export async function shipbobAuthMiddleware(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    await connectToDatabase();

    // Get user ID from headers
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      logger.error('Missing user ID in ShipBob request', { requestId });
      return NextResponse.json(
        {
          success: false,
          error: 'Missing user ID',
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 401 }
      );
    }

    // Find seller
    const seller = await Seller.findOne({ userId });
    if (!seller || !seller.shipbob?.accessToken) {
      logger.error('ShipBob integration not found for seller', { userId, requestId });
      return NextResponse.json(
        {
          success: false,
          error: 'ShipBob integration not connected',
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 401 }
      );
    }

    // Check token expiration
    let accessToken = seller.shipbob.accessToken;
    if (seller.shipbob.expiresAt && new Date() >= seller.shipbob.expiresAt && seller.shipbob.refreshToken) {
      logger.info('ShipBob access token expired, attempting refresh', { userId, requestId });
      try {
        const shipbobService = new ShipBobService({
          clientId: process.env.SHIPBOB_CLIENT_ID!,
          clientSecret: process.env.SHIPBOB_CLIENT_SECRET!,
          redirectUri: process.env.SHIPBOB_REDIRECT_URI!,
          channelId: seller.shipbob.channelId || process.env.SHIPBOB_CHANNEL_ID!,
          userId,
        });

        const tokenResponse = await shipbobService.refreshAccessToken(seller.shipbob.refreshToken);
        accessToken = tokenResponse.access_token;
        const newExpiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);

        await Seller.updateOne(
          { userId },
          {
            $set: {
              'shipbob.accessToken': accessToken,
              'shipbob.refreshToken': tokenResponse.refresh_token || seller.shipbob.refreshToken,
              'shipbob.expiresAt': newExpiresAt,
            },
          }
        );
        logger.info('ShipBob access token refreshed successfully', { userId, requestId });
      } catch (refreshError) {
        const errorMessage = refreshError instanceof Error ? refreshError.message : String(refreshError);
        logger.error('Failed to refresh ShipBob access token', { userId, requestId, error: errorMessage });
        return NextResponse.json(
          {
            success: false,
            error: 'Failed to refresh access token',
            requestId,
            timestamp: new Date().toISOString(),
          },
          { status: 401 }
        );
      }
    }

    // Attach token to request
    (request as any).shipbobAccessToken = accessToken;
    return null; // Proceed to next handler
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('ShipBob auth middleware failed', { requestId, error: errorMessage });
    return NextResponse.json(
      {
        success: false,
        error: 'Authentication failed',
        requestId,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
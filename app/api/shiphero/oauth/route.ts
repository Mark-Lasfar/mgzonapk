// /app/api/shiphero/oauth/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Seller from '@/lib/db/models/seller.model';
import { auth } from '@/auth';
import { logger } from '@/lib/api/services/logging';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    await connectToDatabase();
    const session = await auth();
    if (!session?.user?.id) {
      logger.error('Unauthorized ShipHero OAuth request', { requestId });
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      logger.error('ShipHero OAuth callback error', { error, requestId });
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/seller/dashboard/integrations?error=${encodeURIComponent(error)}`
      );
    }

    if (!code || !state || state !== session.user.id) {
      logger.error('Invalid OAuth callback parameters', { code, state, userId: session.user.id, requestId });
      return NextResponse.json(
        {
          success: false,
          error: 'Missing or invalid code/state',
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const response = await fetch('https://auth.shiphero.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.SHIPHERO_CLIENT_ID!,
        client_secret: process.env.SHIPHERO_CLIENT_SECRET!,
        code,
        grant_type: 'authorization_code',
        redirect_uri: process.env.SHIPHERO_REDIRECT_URI!,
      }).toString(),
    });

    if (!response.ok) {
      let errorMessage = 'Failed to exchange token';
      let errorData;
      try {
        errorData = await response.json();
        errorMessage = errorData.error_description || errorMessage;
      } catch {
        errorMessage = `Non-JSON response: ${(await response.text()).slice(0, 100)}`;
      }
      logger.error('ShipHero OAuth token exchange failed', { error: errorMessage, errorData, requestId });
      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: response.status }
      );
    }

    const tokenData = await response.json();
    logger.info('ShipHero OAuth token response', { tokenData, requestId });

    if (!tokenData.access_token || !tokenData.expires_in) {
      logger.error('Invalid OAuth token response', { tokenData, requestId });
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required token fields',
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    const shipheroIntegration = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData?.refresh_token || null,
      tokenType: tokenData?.token_type || 'Bearer',
      scope: tokenData?.scope || null,
      expiresAt,
      connectedAt: new Date(),
      lastUpdatedAt: new Date(),
    };

    await Seller.updateOne(
      { userId: session.user.id },
      {
        $set: {
          shiphero: shipheroIntegration,
        },
      },
      { upsert: true }
    );

    logger.info('ShipHero integration connected', { userId: session.user.id, requestId });
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/seller/dashboard/integrations?success=true`
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('ShipHero OAuth error', { error: errorMessage, requestId });
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/seller/dashboard/integrations?error=${encodeURIComponent('Failed to connect to ShipHero')}`
    );
  }
}
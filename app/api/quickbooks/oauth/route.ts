// /app/api/quickbooks/oauth/route.ts
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
      logger.error('Unauthorized QuickBooks OAuth request', { requestId });
      return NextResponse.json({ success: false, error: 'Unauthorized', requestId }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      logger.error('QuickBooks OAuth callback error', { error, requestId });
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/seller/dashboard/integrations?error=${encodeURIComponent(error)}`
      );
    }

    if (!code || !state || state !== session.user.id) {
      logger.error('Invalid OAuth callback parameters', { code, state, userId: session.user.id, requestId });
      return NextResponse.json({ success: false, error: 'Missing or invalid code/state', requestId }, { status: 400 });
    }

    const response = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.QUICKBOOKS_CLIENT_ID!,
        client_secret: process.env.QUICKBOOKS_CLIENT_SECRET!,
        code,
        grant_type: 'authorization_code',
        redirect_uri: process.env.QUICKBOOKS_REDIRECT_URI!,
      }).toString(),
    });

    if (!response.ok) {
      const errorData = await response.json();
      logger.error('QuickBooks OAuth token exchange failed', { error: errorData, requestId });
      return NextResponse.json({ success: false, error: 'Failed to exchange token', requestId }, { status: response.status });
    }

    const tokenData = await response.json();
    logger.info('QuickBooks OAuth token response', { tokenData, requestId });

    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    await Seller.updateOne(
      { userId: session.user.id },
      {
        $set: {
          quickbooks: {
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            tokenType: tokenData.token_type,
            expiresAt,
            connectedAt: new Date(),
            lastUpdatedAt: new Date(),
          },
        },
      },
      { upsert: true }
    );

    logger.info('QuickBooks integration connected', { userId: session.user.id, requestId });
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/seller/dashboard/integrations?success=true`
    );
  } catch (error) {
    logger.error('QuickBooks OAuth error', { error: String(error), requestId });
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/seller/dashboard/integrations?error=${encodeURIComponent('Failed to connect to QuickBooks')}`
    );
  }
}
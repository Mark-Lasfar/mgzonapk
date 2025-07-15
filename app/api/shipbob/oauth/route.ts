import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { auth } from '@/auth';
import Integration from '@/lib/db/models/integration.model';
import SellerIntegration from '@/lib/db/models/seller-integration.model';
import { logger } from '@/lib/api/services/logging';
import { randomUUID } from 'crypto';
import OAuthState from '@/lib/db/models/oauth-state.model';

export async function GET(request: NextRequest) {
  const requestId = randomUUID();
  try {
    await connectToDatabase();
    const session = await auth();
    if (!session?.user?.id) {
      logger.error('Unauthorized ShipBob OAuth request', { requestId });
      return NextResponse.json({ error: 'Unauthorized', requestId }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      logger.error('ShipBob OAuth callback error', { error, requestId });
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_BASE_URL}/seller/dashboard/integrations?error=${encodeURIComponent(error)}`
      );
    }

    const integration = await Integration.findOne({ providerName: 'ShipBob' });
    if (!integration || !integration.oauth?.enabled) {
      logger.error('ShipBob integration not found', { requestId });
      return NextResponse.json({ error: 'ShipBob integration not found', requestId }, { status: 400 });
    }

    const oauthState = await OAuthState.findOne({ state, providerId: integration._id });
    if (!code || !state || !oauthState) {
      logger.error('Invalid OAuth callback parameters', { code, state, requestId });
      return NextResponse.json({ error: 'Missing or invalid code/state', requestId }, { status: 400 });
    }

    const response = await fetch(integration.oauth.tokenUrl!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: integration.credentials.clientId!,
        client_secret: integration.credentials.clientSecret!,
        code,
        grant_type: 'authorization_code',
        redirect_uri: integration.credentials.redirectUri!,
      }).toString(),
    });

    if (!response.ok) {
      const errorData = await response.json();
      const errorMessage = errorData.error_description || 'Failed to exchange token';
      logger.error('ShipBob OAuth token exchange failed', { error: errorMessage, requestId });
      return NextResponse.json({ error: errorMessage, requestId }, { status: response.status });
    }

    const tokenData = await response.json();
    if (!tokenData.access_token || !tokenData.expires_in) {
      logger.error('Invalid OAuth token response', { tokenData, requestId });
      return NextResponse.json({ error: 'Missing required token fields', requestId }, { status: 400 });
    }

    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
    await SellerIntegration.updateOne(
      { sellerId: session.user.id, integrationId: integration._id, sandbox: false },
      {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || null,
        expiresAt,
        isActive: true,
        status: 'connected',
        lastConnectedAt: new Date(),
        metadata: { channelId: integration.credentials.channelId || null },
        connectedBy: session.user.id,
        connectedByRole: 'seller',
        connectionType: 'oauth',
        history: [{ event: 'connected', date: new Date() }],
      },
      { upsert: true }
    );

    await OAuthState.deleteOne({ _id: oauthState._id });

    logger.info('ShipBob integration connected', { userId: session.user.id, requestId });
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/seller/dashboard/integrations?success=true`
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('ShipBob OAuth error', { error: errorMessage, requestId });
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/seller/dashboard/integrations?error=${encodeURIComponent('Failed to connect to ShipBob')}`
    );
  }
}
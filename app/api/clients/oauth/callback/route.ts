import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { connectToDatabase } from '@/lib/db';
import Client from '@/lib/db/models/client.model';
import SellerIntegration from '@/lib/db/models/seller-integration.model';
import OAuthState from '@/lib/db/models/oauth-state.model';
import { customLogger } from '@/lib/api/services/logging';
import { getTranslations } from 'next-intl/server';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';
import { encrypt } from '@/lib/utils/encryption';

export async function GET(req: NextRequest) {
  const requestId = uuidv4();
  const t = await getTranslations('api.clients.oauth.callback');
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const authSession = await auth();
    if (!authSession?.user?.id || authSession.user.role !== 'SELLER') {
      await customLogger.error('Unauthorized access to OAuth callback', { requestId, service: 'api' });
      return NextResponse.json(
        { success: false, error: t('unauthorized'), requestId, timestamp: new Date().toISOString() },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const sandbox = searchParams.get('sandbox') === 'true';

    if (!code || !state) {
      await customLogger.error('Missing code or state in OAuth callback', { requestId, service: 'api' });
      return NextResponse.json(
        { success: false, error: t('invalid_request'), requestId, timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    await connectToDatabase(sandbox ? 'sandbox' : 'live');

    const oauthState = await OAuthState.findOne({ state, sandbox }).session(session);
    if (!oauthState) {
      await customLogger.error('Invalid or expired state', { requestId, state, service: 'api' });
      return NextResponse.json(
        { success: false, error: t('invalid_state'), requestId, timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    const client = await Client.findById(oauthState.providerId).session(session);
    if (!client || client.status !== 'approved') {
      await customLogger.error('Client not found or not approved', { requestId, service: 'api' });
      return NextResponse.json(
        { success: false, error: t('invalid_client'), requestId, timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    // تبادل الـ code للحصول على access token
    const tokenUrl = client.tokenUrl || 'https://api.mgzon.com/oauth/token'; // افتراضي إذا لم يُحدد
    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/clients/oauth/callback?sandbox=${sandbox}`;

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: client.clientId,
        client_secret: client.clientSecret,
      }),
    });

    if (!tokenResponse.ok) {
      await customLogger.error('Failed to exchange OAuth code', { requestId, service: 'api' });
      return NextResponse.json(
        { success: false, error: t('token_exchange_failed'), requestId, timestamp: new Date().toISOString() },
        { status: 400 }
      );
    }

    const tokenData = await tokenResponse.json();
    const encryptedCredentials = {
      access_token: encrypt(tokenData.access_token),
      refresh_token: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : undefined,
      expires_in: tokenData.expires_in,
    };

    await SellerIntegration.create(
      [
        {
          sellerId: oauthState.sellerId,
          integrationId: client._id,
          providerName: client.name,
          sandbox,
          isActive: true,
          status: 'connected',
          credentials: encryptedCredentials,
          connectionType: 'oauth',
          history: [{ event: 'connected', date: new Date() }],
        },
      ],
      { session }
    );

    await OAuthState.deleteOne({ state, sandbox }, { session });

    await session.commitTransaction();
    await customLogger.info('OAuth callback processed successfully for client', {
      requestId,
      clientId: client._id,
      sellerId: oauthState.sellerId,
      service: 'api',
    });

    return NextResponse.redirect(`/seller/dashboard/integrations?sandbox=${sandbox}`);
  } catch (error) {
    await session.abortTransaction();
    const errorMessage = error instanceof Error ? error.message : t('unknown_error');
    await customLogger.error('Failed to process OAuth callback for client', {
      requestId,
      error: errorMessage,
      service: 'api',
    });
    return NextResponse.json(
      { success: false, error: errorMessage, requestId, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  } finally {
    session.endSession();
  }
}